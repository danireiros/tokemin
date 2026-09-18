#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { compress } from "../core/pipeline.js";
import { initNodeTokenizer } from "../core/tokenizer-node.js";

function parseArgs(argv) {
  const flags = new Set();
  const values = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === "--help") flags.add("help");
    else if (item.startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("-")) {
      values[item.slice(2)] = argv[i + 1];
      i += 1;
    } else if (item.startsWith("--")) {
      flags.add(item.slice(2));
    } else {
      positional.push(item);
    }
  }
  return { flags, values, positional };
}

function readInput(positional) {
  const command = positional[0] === "compress" ? positional.slice(1) : positional;
  if (command[0]) return readFileSync(command[0], "utf8");
  return readFileSync(0, "utf8");
}

const { flags, values, positional } = parseArgs(process.argv.slice(2));

if (flags.has("help") || positional[0] === "help") {
  process.stdout.write(
    "tokemin compress [--mode message|system|context|chat] [--aggressiveness soft|medium|hard|budget] [--budget 800] [--query text] [archivo]\n",
  );
  process.exit(0);
}

await initNodeTokenizer(values.encoding || "o200k_base");

const result = compress(readInput(positional), {
  mode: values.mode || "message",
  aggressiveness: values.aggressiveness || "medium",
  budgetTokens: Number(values.budget || 800),
  query: values.query || "",
  protectCode: !flags.has("no-protect"),
  shortOutput: flags.has("short"),
  denseEnglish: flags.has("dense"),
  stripCodeComments: flags.has("strip-comments"),
});

if (flags.has("json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  for (const warning of result.warnings) process.stderr.write(`${warning}\n`);
  process.stderr.write(`${result.tokensIn} → ${result.tokensOut} tokens\n`);
  process.stdout.write(`${result.text}\n`);
}
