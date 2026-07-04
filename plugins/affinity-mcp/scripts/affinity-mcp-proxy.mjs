#!/usr/bin/env node

const AFFINITY_BASE_URL = process.env.AFFINITY_MCP_BASE_URL || "http://localhost:6767";
const AFFINITY_PROTOCOL_VERSION =
  process.env.AFFINITY_MCP_PROTOCOL_VERSION || "2025-11-25";

const STATIC_TOOLS = [
  {
    name: "add_sdk_hint",
    description: "Add a hint to the Affinity SDK preamble document for future sessions.",
    inputSchema: {
      type: "object",
      properties: { hint: { type: "string", description: "The hint to add." } },
      required: ["hint"],
    },
  },
  {
    name: "execute_script",
    description:
      "Execute JavaScript in Affinity and return results. Read the preamble documentation first.",
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "JavaScript to execute in Affinity." },
      },
      required: ["script"],
    },
  },
  {
    name: "list_library_scripts",
    description: "List scripts currently saved in Affinity's script library.",
    inputSchema: { type: "object" },
  },
  {
    name: "list_sdk_documentation",
    description: "List Affinity SDK documentation topics.",
    inputSchema: { type: "object" },
  },
  {
    name: "read_library_script",
    description: "Read a script from Affinity's script library.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string", description: "The script title." } },
      required: ["title"],
    },
  },
  {
    name: "read_sdk_documentation_topic",
    description:
      "Read an Affinity SDK documentation topic. Call this with filename 'preamble' before other SDK topics.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "SDK documentation filename from list_sdk_documentation.",
        },
      },
      required: ["filename"],
    },
  },
  {
    name: "render_selection",
    description: "Render selected Affinity nodes to a base64 JPEG.",
    inputSchema: {
      type: "object",
      properties: {
        document_session_uuid: {
          type: "string",
          description: "The session UUID of the document to render.",
        },
      },
      required: ["document_session_uuid"],
    },
  },
  {
    name: "render_spread",
    description: "Render an Affinity spread to a base64 JPEG.",
    inputSchema: {
      type: "object",
      properties: {
        document_session_uuid: {
          type: "string",
          description: "The session UUID of the document to render.",
        },
        spread_index: {
          type: "number",
          description: "The zero-based index of the spread to render.",
        },
      },
      required: ["document_session_uuid", "spread_index"],
    },
  },
  {
    name: "report_sdk_issue",
    description: "Report a real Affinity SDK issue to Affinity.",
    inputSchema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Description of the SDK issue." },
        code: { type: "string", description: "JavaScript demonstrating the issue." },
      },
      required: ["description"],
    },
  },
  {
    name: "save_script_to_library",
    description: "Save a completed JavaScript script into Affinity's script library.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Script title." },
        description: { type: "string", description: "Brief script description." },
        code: { type: "string", description: "The JavaScript code." },
      },
      required: ["title", "description", "code"],
    },
  },
  {
    name: "search_sdk_hints",
    description: "Search Affinity SDK hints for a problem or task.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "The issue or task to search for." },
      },
      required: ["prompt"],
    },
  },
];

class AffinitySseClient {
  constructor() {
    this.controller = null;
    this.endpointPath = null;
    this.pending = new Map();
    this.nextId = 1;
    this.connected = false;
    this.connecting = null;
    this.eventName = "";
    this.eventData = "";
  }

  async connect() {
    if (this.connected) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.#connect();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async #connect() {
    await this.close();
    this.controller = new AbortController();
    const res = await fetch(`${AFFINITY_BASE_URL}/sse`, {
      headers: { Accept: "text/event-stream" },
      signal: this.controller.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`Affinity MCP SSE failed: HTTP ${res.status}`);
    }
    this.#readSse(res.body);
    await this.#waitForEndpoint();
    await this.request("initialize", {
      protocolVersion: AFFINITY_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "codex-affinity-mcp-proxy", version: "0.1.0" },
    });
    await this.notify("notifications/initialized", {});
    this.connected = true;

    try {
      await this.callTool("read_sdk_documentation_topic", { filename: "preamble" });
    } catch {
      // Preamble priming improves SDK behavior, but discovery can still work without it.
    }
  }

  async close() {
    this.connected = false;
    this.endpointPath = null;
    if (this.controller) this.controller.abort();
    this.controller = null;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error("Affinity MCP connection closed"));
    }
    this.pending.clear();
  }

  #readSse(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          for (;;) {
            const nl = buffer.indexOf("\n");
            if (nl < 0) break;
            const line = buffer.slice(0, nl).replace(/\r$/, "");
            buffer = buffer.slice(nl + 1);
            if (line === "") {
              this.#flushEvent();
            } else if (line.startsWith("event:")) {
              this.eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              this.eventData += line.slice(5).trimStart();
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") this.#failAll(err);
      } finally {
        this.connected = false;
      }
    })();
  }

  #flushEvent() {
    if (!this.eventName && !this.eventData) return;
    if (this.eventName === "endpoint") {
      this.endpointPath = this.eventData.trim();
    } else if (this.eventName === "message" && this.eventData.trim()) {
      const msg = JSON.parse(this.eventData);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    }
    this.eventName = "";
    this.eventData = "";
  }

  #failAll(err) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(err);
    }
    this.pending.clear();
  }

  async #waitForEndpoint() {
    for (let i = 0; i < 50; i += 1) {
      if (this.endpointPath) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Timed out waiting for Affinity MCP endpoint");
  }

  async request(method, params) {
    if (!this.endpointPath) throw new Error("Affinity MCP endpoint is not ready");
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Timed out waiting for Affinity MCP ${method}`));
        }
      }, 30000);
      this.pending.set(id, { resolve, reject, timer });
    });

    await this.#post({ jsonrpc: "2.0", id, method, params });
    return result;
  }

  async notify(method, params) {
    await this.#post({ jsonrpc: "2.0", method, params });
  }

  async #post(payload) {
    const url = new URL(this.endpointPath, AFFINITY_BASE_URL);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Affinity MCP POST failed: HTTP ${res.status} ${await res.text()}`);
    }
  }

  async listTools() {
    await this.connect();
    const result = await this.request("tools/list", {});
    return result.tools || STATIC_TOOLS;
  }

  async callTool(name, args) {
    await this.connect();
    try {
      return await this.request("tools/call", {
        name,
        arguments: args || {},
      });
    } catch (err) {
      if (/closed|disconnected|not connected|session/i.test(err.message)) {
        await this.close();
        await this.connect();
        return this.request("tools/call", { name, arguments: args || {} });
      }
      throw err;
    }
  }
}

const affinity = new AffinitySseClient();
let inputBuffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  for (;;) {
    const separator = inputBuffer.indexOf("\r\n\r\n");
    if (separator < 0) return;
    const header = inputBuffer.slice(0, separator).toString("utf8");
    const match = header.match(/content-length:\s*(\d+)/i);
    if (!match) {
      inputBuffer = inputBuffer.slice(separator + 4);
      continue;
    }
    const length = Number(match[1]);
    const start = separator + 4;
    const end = start + length;
    if (inputBuffer.length < end) return;
    const rawMessage = inputBuffer.slice(start, end).toString("utf8");
    inputBuffer = inputBuffer.slice(end);
    handleMessage(JSON.parse(rawMessage)).catch((err) => {
      try {
        const parsed = JSON.parse(rawMessage);
        if (parsed.id != null) sendError(parsed.id, -32603, err.message);
      } catch {
        // Ignore malformed input after best-effort error handling.
      }
    });
  }
});

process.on("SIGINT", async () => {
  await affinity.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await affinity.close();
  process.exit(0);
});

async function handleMessage(message) {
  if (message.id == null) return;

  try {
    switch (message.method) {
      case "initialize":
        sendResult(message.id, {
          protocolVersion: message.params?.protocolVersion || "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: { name: "affinity-mcp", version: "0.1.0" },
          instructions:
            "Use Affinity by Canva through its local MCP server. Read read_sdk_documentation_topic with filename 'preamble' before writing or executing scripts.",
        });
        break;

      case "ping":
        sendResult(message.id, {});
        break;

      case "tools/list":
        try {
          sendResult(message.id, { tools: await affinity.listTools() });
        } catch {
          sendResult(message.id, { tools: STATIC_TOOLS });
        }
        break;

      case "tools/call":
        if (!message.params?.name) throw new Error("Missing tool name");
        sendResult(
          message.id,
          await affinity.callTool(message.params.name, message.params.arguments || {}),
        );
        break;

      case "resources/list":
        sendResult(message.id, { resources: [] });
        break;

      case "prompts/list":
        sendResult(message.id, { prompts: [] });
        break;

      default:
        sendError(message.id, -32601, `Unsupported method: ${message.method}`);
    }
  } catch (err) {
    sendError(
      message.id,
      -32603,
      `Affinity MCP proxy error: ${err.message}. Ensure Affinity is running and MCP is enabled.`,
    );
  }
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}
