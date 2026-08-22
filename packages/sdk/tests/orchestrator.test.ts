/**
 * Orchestrator client integration tests against a fake Go server that
 * reproduces the exact JSON-RPC 2.0 / UDS wire behavior of
 * go-services/swarm_orchestrator/internal/server: submit/status/cancel,
 * "event" push notifications, app error codes and reconnect on restart.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as net from "node:net";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  ConnectionClosedError,
  JsonRpcError,
  OperationTimeoutError,
  type AgentEvent,
  OrchestratorClient,
  makeTaskId,
} from "../src/index.js";

const FAKE_SERVER_SRC = `
const net = require("net");
const fs = require("fs");
const socketPath = process.argv[1];
try { fs.unlinkSync(socketPath); } catch {}
const tasks = new Map();
const server = net.createServer((socket) => {
  let buffer = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    for (;;) {
      const idx = buffer.indexOf("\\n");
      if (idx < 0) break;
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) handle(line, socket);
    }
  });
});
function send(socket, obj) { socket.write(JSON.stringify(obj) + "\\n"); }
function handle(line, socket) {
  let req; try { req = JSON.parse(line); } catch { return; }
  if (req.method === "orchestrator.submit") {
    if (tasks.has(req.params.taskId)) {
      send(socket, { jsonrpc: "2.0", id: req.id, error: { code: -32002, message: "task id already active" } });
      return;
    }
    tasks.set(req.params.taskId, { state: "running" });
    send(socket, { jsonrpc: "2.0", id: req.id, result: { accepted: true, taskId: req.params.taskId } });
    send(socket, { jsonrpc: "2.0", method: "event", params: { taskId: req.params.taskId, type: "task.submitted", at: new Date().toISOString() } });
    setTimeout(() => {
      const task = tasks.get(req.params.taskId);
      if (task && task.state === "running") {
        task.state = "done";
        send(socket, { jsonrpc: "2.0", method: "event", params: { taskId: req.params.taskId, type: "task.completed", at: new Date().toISOString() } });
      }
    }, 40);
  } else if (req.method === "orchestrator.status") {
    const task = tasks.get(req.params.taskId);
    if (!task) {
      send(socket, { jsonrpc: "2.0", id: req.id, error: { code: -32001, message: "unknown task" } });
    } else {
      send(socket, { jsonrpc: "2.0", id: req.id, result: { taskId: req.params.taskId, state: task.state, stage: "architect", events: [] } });
    }
  } else if (req.method === "orchestrator.cancel") {
    const task = tasks.get(req.params.taskId);
    if (task) task.state = "canceled";
    send(socket, { jsonrpc: "2.0", id: req.id, result: { cancelled: Boolean(task), taskId: req.params.taskId } });
  } else {
    send(socket, { jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "method " + req.method + " not found" } });
  }
}
server.listen(socketPath);
process.on("SIGTERM", () => process.exit(0));
`;

interface FakeServer {
  stop(): Promise<void>;
}

function probeSocket(socketPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const probe = net.connect(socketPath);
    probe.once("connect", () => {
      probe.destroy();
      resolve();
    });
    probe.once("error", reject);
  });
}

async function startFakeServer(socketPath: string): Promise<FakeServer> {
  const child = spawn(process.execPath, ["-e", FAKE_SERVER_SRC, socketPath], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  const deadline = Date.now() + 5_000;
  for (;;) {
    try {
      await probeSocket(socketPath);
      break;
    } catch {
      if (Date.now() > deadline) {
        child.kill("SIGKILL");
        throw new Error("fake orchestrator did not start listening in time");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  return {
    async stop(): Promise<void> {
      child.kill("SIGTERM");
      await once(child, "close").catch(() => undefined);
      // Give the kernel a moment to release the path before rebinding.
      for (let i = 0; i < 40; i++) {
        try {
          await probeSocket(socketPath);
          await new Promise((resolve) => setTimeout(resolve, 25));
        } catch {
          return;
        }
      }
    },
  };
}

describe("OrchestratorClient against a fake UDS server", () => {
  let workDir: string;
  let socketPath: string;
  let server: FakeServer | undefined;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "izanagi-orch-"));
    socketPath = path.join(workDir, "swarm.sock");
  });

  afterEach(async () => {
    await server?.stop();
    server = undefined;
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("submits, receives event pushes, tracks status to terminal state", async () => {
    server = await startFakeServer(socketPath);
    const client = new OrchestratorClient({
      socketPath,
      reconnectAttempts: 0,
      requestTimeoutMs: 4_000,
    });
    const events: AgentEvent[] = [];
    client.onEvent((event) => events.push(event));

    const submit = await client.submit({
      taskId: makeTaskId("test-task-1"),
      task: "write a fibonacci module",
      agentChain: ["architect"],
    });
    assert.deepEqual(submit, { accepted: true, taskId: "test-task-1" });

    const running = await client.status("test-task-1");
    assert.equal(running.state, "running");

    const terminal = await client.awaitTerminal("test-task-1", { timeoutMs: 5_000 });
    assert.equal(terminal.status.state, "done");
    assert.ok(terminal.pollCount >= 2);

    assert.ok(events.some((event) => event.type === "task.submitted"));
    assert.ok(events.some((event) => event.type === "task.completed"));

    client.close();
  });

  it("maps application error codes to typed JsonRpcError", async () => {
    server = await startFakeServer(socketPath);
    const client = new OrchestratorClient({ socketPath, requestTimeoutMs: 4_000 });

    await assert.rejects(client.status("missing-task"), (error: unknown) => {
      const typed = error as JsonRpcError;
      return typed instanceof JsonRpcError && typed.code === -32001 && typed.isApplicationError;
    });

    await client.submit({ taskId: makeTaskId("dup-task"), task: "first" });
    await assert.rejects(
      client.submit({ taskId: makeTaskId("dup-task"), task: "second" }),
      (error: unknown) => error instanceof JsonRpcError && error.code === -32002,
    );

    const cancel = await client.cancel("dup-task");
    assert.deepEqual(cancel, { cancelled: true, taskId: "dup-task" });

    client.close();
  });

  it("rejects with SocketUnavailableError when nothing listens on the path", async () => {
    const client = new OrchestratorClient({ socketPath, reconnectAttempts: 0 });
    await assert.rejects(client.status("nope"), (error: unknown) => {
      return (
        error instanceof Error &&
        error.name === "SocketUnavailableError" &&
        error.message.includes(socketPath)
      );
    });
    client.close();
  });

  it("reconnects after the server restarts on the same socket path", async () => {
    server = await startFakeServer(socketPath);
    const client = new OrchestratorClient({
      socketPath,
      requestTimeoutMs: 4_000,
      reconnectAttempts: 8,
      reconnectDelayMs: 60,
    });

    await client.submit({ taskId: makeTaskId("before-restart"), task: "a" });

    await server.stop();
    server = await startFakeServer(socketPath);

    // The restarted fake server holds no tasks: a round-tripped -32001
    // proves the client transparently reconnected to the new instance.
    await assert.rejects(client.status("after-restart"), (error: unknown) => {
      return error instanceof JsonRpcError && error.code === -32001;
    });
    client.close();
  });

  it("fails requests when the peer dies mid-flight without reconnect budget", async () => {
    const standaloneServer = await startFakeServer(socketPath);
    const client = new OrchestratorClient({
      socketPath,
      requestTimeoutMs: 10_000,
      reconnectAttempts: 0,
    });

    const failurePromise = client.status("whatever").then(
      () => null,
      (error: unknown) => error,
    );
    await standaloneServer.stop();

    const failure = await failurePromise;
    assert.ok(
      failure instanceof ConnectionClosedError ||
        failure instanceof OperationTimeoutError ||
        (failure instanceof Error && failure.name === "SocketUnavailableError"),
      `expected a connection-class error, got ${String(failure)}`,
    );
    client.close();
  });
});
