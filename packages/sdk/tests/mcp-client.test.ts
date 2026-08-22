/**
 * MCP client tests: discovery through a fake `izanagi-mcp` harness binary
 * and native tool invocation against a fake stdio JSON-RPC 2.0 server that
 * mirrors crates/izanagi_mcp's wire contract (initialize, notifications/
 * initialized, tools/list, tools/call).
 */

import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  ConnectionClosedError,
  JsonRpcError,
  McpClient,
} from "../src/index.js";

const HARNESS_SRC = `#!/usr/bin/env node
// Fake izanagi-mcp harness: ignores server argv, prints the two NDJSON steps.
process.stdout.write(JSON.stringify({
  step: "initialize",
  result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "fake-fs", version: "1.0.0" } },
}) + "\\n");
process.stdout.write(JSON.stringify({
  step: "tools/list",
  tools: [
    { name: "fs_write", description: "writes a file", inputSchema: { type: "object", required: ["path", "content"] } },
    { name: "execute_command", inputSchema: { type: "object" } },
  ],
}) + "\\n");
`;

const FAKE_SERVER_SRC = `#!/usr/bin/env node
const readline = require("readline");
const rl = readline.createInterface({ input: process.stdin });
const tools = [
  { name: "fs_write", description: "writes a file", inputSchema: { type: "object" } },
];
function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n");
}
rl.on("line", (line) => {
  let frame; try { frame = JSON.parse(line); } catch { return; }
  if (frame.method === "initialize") {
    reply(frame.id, {
      protocolVersion: frame.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "fake-fs-server", version: "2.0.0" },
    });
  } else if (frame.method === "tools/list") {
    reply(frame.id, { tools });
  } else if (frame.method === "tools/call") {
    if (frame.params.name === "explode") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0", id: frame.id,
        error: { code: -32602, message: "invalid tool arguments", data: { name: frame.params.name } },
      }) + "\\n");
      return;
    }
    reply(frame.id, {
      content: [{ type: "text", text: "wrote:" + String(frame.params.arguments.path) }],
      isError: false,
    });
  }
  // Notifications (no id) are never answered.
});
`;

async function writeExecutable(directory: string, name: string, source: string): Promise<string> {
  const filePath = path.join(directory, name);
  await writeFile(filePath, source, { mode: 0o755 });
  await chmod(filePath, 0o755);
  return filePath;
}

describe("McpClient discovery via the Rust harness binary", () => {
  let workDir: string;
  let harnessPath: string;

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "izanagi-mcp-"));
    harnessPath = await writeExecutable(workDir, "izanagi-mcp", HARNESS_SRC);
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("parses initialize and tools/list steps into McpDiscoveryResult", async () => {
    const client = new McpClient({
      binaryPath: harnessPath,
      serverCommand: ["ignored", "server", "command"],
      requestTimeoutMs: 5_000,
    });
    const discovery = await client.discoverTools();
    assert.equal(discovery.protocolVersion, "2025-06-18");
    assert.equal(discovery.serverInfo?.name, "fake-fs");
    assert.equal(discovery.serverInfo?.version, "1.0.0");
    assert.equal(discovery.tools.length, 2);
    assert.equal(discovery.tools[0]?.name, "fs_write");
    await client.close();
  });

  it("raises BinaryNotFoundError when the harness is missing", async () => {
    const client = new McpClient({
      binaryPath: path.join(workDir, "nope"),
      serverCommand: ["x"],
    });
    await assert.rejects(client.discoverTools(), (error: unknown) => {
      return error instanceof Error && error.name === "BinaryNotFoundError";
    });
    await client.close();
  });

  it("rejects an empty server command at construction time", () => {
    assert.throws(() => new McpClient({ serverCommand: [], binaryPath: harnessPath }), /non-empty serverCommand/);
  });
});

describe("McpClient native stdio session", () => {
  let workDir: string;
  let serverScript: string;
  let serverCommand: readonly string[];

  beforeEach(async () => {
    workDir = await mkdtemp(path.join(tmpdir(), "izanagi-session-"));
    serverScript = path.join(workDir, "fake-server.cjs");
    await writeFile(serverScript, FAKE_SERVER_SRC.replace("#!/usr/bin/env node\n", ""), "utf8");
    serverCommand = [process.execPath, serverScript];
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("handshakes, lists tools and calls tools over one session", async () => {
    const client = new McpClient({ serverCommand, requestTimeoutMs: 5_000 });
    assert.equal(client.connected, false);

    await client.connect();
    assert.equal(client.connected, true);

    // connect() twice must be a no-op while alive.
    await client.connect();

    const tools = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ["fs_write"],
    );

    const call = await client.callTool({
      name: "fs_write",
      arguments: { path: "/tmp/out.txt", content: "hello" },
    });
    assert.equal(call.isError, undefined);
    const text = (call.content?.[0] as { text?: string } | undefined)?.text;
    assert.equal(text, "wrote:/tmp/out.txt");

    await client.close();
    assert.equal(client.connected, false);
  });

  it("maps JSON-RPC error frames to typed JsonRpcError", async () => {
    const client = new McpClient({ serverCommand, requestTimeoutMs: 5_000 });
    await client.connect();
    await assert.rejects(
      client.callTool({ name: "explode", arguments: {} }),
      (error: unknown) => {
        const typed = error as JsonRpcError;
        return (
          typed instanceof JsonRpcError &&
          typed.code === -32602 &&
          typed.message.includes("invalid tool arguments") &&
          (typed.data as Record<string, unknown> | undefined)?.["name"] === "explode"
        );
      },
    );
    await client.close();
  });

  it("requires connect() before use and fails cleanly when the server dies", async () => {
    const client = new McpClient({ serverCommand, requestTimeoutMs: 5_000 });
    await assert.rejects(client.listTools(), (error: unknown) => error instanceof ConnectionClosedError);

    await client.connect();
    // Kill the underlying server out-of-band by destroying the session.
    await client.close();
    await assert.rejects(
      client.callTool({ name: "fs_write", arguments: {} }),
      (error: unknown) => error instanceof ConnectionClosedError,
    );
  });
});
