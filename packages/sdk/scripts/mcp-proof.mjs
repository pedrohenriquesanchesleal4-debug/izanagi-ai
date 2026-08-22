/**
 * Proof script: MCP discovery through the REAL izanagi-mcp Rust binary
 * against a real MCP server (Node stdio JSON-RPC), plus a native tools/call
 * round trip writing a file to disk.
 */

import { writeFile, readFile } from "node:fs/promises";
import { McpClient } from "../dist/src/index.js";

const SERVER_SRC = `
const readline = require("readline");
const fs = require("fs");
const rl = readline.createInterface({ input: process.stdin });
function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n"); }
rl.on("line", (line) => {
  let f; try { f = JSON.parse(line); } catch { return; }
  if (f.method === "initialize") {
    reply(f.id, { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "proof-fs", version: "3.1.4" } });
  } else if (f.method === "tools/list") {
    reply(f.id, { tools: [
      { name: "fs_write", description: "write text to disk", inputSchema: { type: "object", required: ["path","content"] } },
      { name: "execute_command", description: "run a shell command", inputSchema: { type: "object" } },
    ]});
  } else if (f.method === "tools/call") {
    fs.writeFileSync(String(f.params.arguments.path), String(f.params.arguments.content));
    reply(f.id, { content: [{ type: "text", text: "wrote " + f.params.arguments.path }] });
  }
});
`;

const serverPath = "/tmp/opencode/mcp-proof-server.cjs";
const outputPath = "/tmp/opencode/mcp-proof-out.txt";
await writeFile(serverPath, SERVER_SRC, "utf8");

const client = new McpClient({
  // No binaryPath: resolves the REAL harness via $IZANAGI_MCP_BIN or target/debug.
  serverCommand: [process.execPath, serverPath],
  requestTimeoutMs: 10_000,
});

await client.connect();
const discovery = await client.discoverTools();
console.log("harness discovery.protocolVersion =", discovery.protocolVersion);
console.log("harness discovery.serverInfo      =", JSON.stringify(discovery.serverInfo));
console.log(
  "harness discovery.tools           =",
  discovery.tools.map((tool) => `${tool.name}(${JSON.stringify(tool.inputSchema.required ?? [])})`).join(", "),
);

console.log("native session listTools          =",
  (await client.listTools()).map((tool) => tool.name).join(", "));

const call = await client.callTool({
  name: "fs_write",
  arguments: { path: outputPath, content: "written by the izanagi SDK" },
});
console.log("native callTool fs_write          =", call.content?.[0]?.text, "| isError:", Boolean(call.isError));
console.log("file on disk                      =", JSON.stringify(await readFile(outputPath, "utf8")));
await client.close();
