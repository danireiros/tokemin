#!/usr/bin/env node
import { compress } from "../core/pipeline.js";
import { initNodeTokenizer } from "../core/tokenizer-node.js";

const PROTOCOL = "2024-11-05";

await initNodeTokenizer();

const tools = [
  {
    name: "compress",
    description:
      "Comprime un prompt para gastar menos tokens. Úsalo ANTES de reenviar contexto largo a otro modelo o subagente.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
        mode: { type: "string", enum: ["message", "system", "context", "chat"] },
        aggressiveness: { type: "string", enum: ["soft", "medium", "hard", "budget"] },
        budget_tokens: { type: "number" },
        query: { type: "string" },
        short_output: { type: "boolean" },
        dense_english: { type: "boolean" },
      },
    },
  },
  {
    name: "compress_context",
    description: "Comprime documentos o dumps respecto a una pregunta, hasta un presupuesto de tokens.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string" },
        query: { type: "string" },
        budget_tokens: { type: "number" },
      },
    },
  },
];

function runTool(name, args = {}) {
  const shared = {
    protectCode: true,
    shortOutput: Boolean(args.short_output),
    denseEnglish: Boolean(args.dense_english),
    budgetTokens: Number(args.budget_tokens) || 800,
    query: String(args.query ?? ""),
  };

  if (name === "compress_context") {
    return compress(String(args.text ?? ""), { ...shared, mode: "context", aggressiveness: "budget" });
  }
  return compress(String(args.text ?? ""), {
    ...shared,
    mode: args.mode || "message",
    aggressiveness: args.aggressiveness || "medium",
  });
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, message) {
  send({ jsonrpc: "2.0", id, error: { code: -32000, message } });
}

function send(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function handle(message) {
  const { id, method, params } = message;
  if (method === "initialize") {
    reply(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: { name: "tokemin", version: "0.1.0" },
    });
    return;
  }
  if (method === "notifications/initialized" || method === "initialized") return;
  if (method === "tools/list") {
    reply(id, { tools });
    return;
  }
  if (method === "tools/call") {
    try {
      const result = runTool(params?.name, params?.arguments ?? {});
      reply(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              text: result.text,
              tokens_in: result.tokensIn,
              tokens_out: result.tokensOut,
              ratio: result.ratio,
              warnings: result.warnings,
            }),
          },
        ],
      });
    } catch (error) {
      fail(id, error instanceof Error ? error.message : "compress failed");
    }
    return;
  }
  if (id !== undefined) fail(id, `Unknown method: ${method}`);
}

let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const body = buffer.slice(start, start + length).toString("utf8");
    buffer = buffer.slice(start + length);
    try {
      handle(JSON.parse(body));
    } catch {
      // ignore malformed frames
    }
  }
});
