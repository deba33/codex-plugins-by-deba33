import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("MCP stdio accepts fragmented UTF-8, batched messages, and malformed JSON", async (t) => {
  const child = spawn(process.execPath, [fileURLToPath(new URL("./affinity-mcp-proxy.mjs", import.meta.url))]);
  t.after(() => child.kill());
  const responses = [];
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => responses.push(JSON.parse(line)));
  const request = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: "初", method: "initialize", params: { protocolVersion: "2025-11-25" } }) + "\n");
  const split = request.indexOf(Buffer.from("初")) + 1;
  child.stdin.write(request.subarray(0, split));
  await new Promise((resolve) => setTimeout(resolve, 30));
  child.stdin.write(request.subarray(split));
  child.stdin.write('{broken}\n' + JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n" + JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }) + "\n");
  const deadline = Date.now() + 2000;
  while (responses.length < 3 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(responses.length, 3, "proxy must respond to newline-delimited MCP messages");
  assert.equal(responses[0].id, "初");
  assert.equal(responses[0].result.protocolVersion, "2025-11-25");
  assert.equal(responses[1].error.code, -32700);
  assert.deepEqual(responses[2], { jsonrpc: "2.0", id: 2, result: {} });
  const exited = once(child, "exit");
  child.stdin.end();
  const timer = setTimeout(() => child.kill(), 2000);
  const [code] = await exited;
  clearTimeout(timer);
  assert.equal(code, 0, "proxy must exit when the client closes stdin");
});

test("live Affinity discovery and SDK read through the configured launcher", { skip: !process.env.AFFINITY_MCP_LIVE_TEST, timeout: 20000 }, async (t) => {
  const configPath = process.env.AFFINITY_MCP_TEST_CONFIG || new URL("../.mcp.json", import.meta.url);
  const config = JSON.parse(await readFile(configPath, "utf8")).mcpServers["affinity-by-canva"];
  const child = spawn(config.command, config.args, { env: { ...process.env, ...config.env } });
  t.after(() => child.kill());
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  lines.on("line", (line) => {
    const response = JSON.parse(line);
    pending.get(response.id)?.(response);
    pending.delete(response.id);
  });
  const request = (id, method, params = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No response for ${method}: ${stderr}`)), 8000);
    pending.set(id, (response) => { clearTimeout(timer); resolve(response); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  const init = await request(1, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "affinity-smoke-test", version: "1.0.0" } });
  assert.ok(init.result?.capabilities.tools);
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const discovery = await request(2, "tools/list");
  assert.ok(discovery.result?.tools.some((tool) => tool.name === "read_sdk_documentation_topic"));
  const preamble = await request(3, "tools/call", { name: "read_sdk_documentation_topic", arguments: { filename: "preamble" } });
  assert.equal(preamble.error, undefined, JSON.stringify(preamble.error));
  assert.ok(!preamble.result?.isError, JSON.stringify(preamble.result));
  assert.ok(preamble.result?.content?.some((item) => item.type === "text" && item.text.length > 0));
  const exited = once(child, "exit");
  child.stdin.end();
  const [code] = await exited;
  assert.equal(code, 0);
});
