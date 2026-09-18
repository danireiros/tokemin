import { normalizeWhitespace } from "./rules.js";

const CONSTRAINT_RE =
  /\b(no |nunca |jamás |jamas |excepto |salvo |sin |must not|do not|don't |dont |never |except |unless |not )\p{L}/iu;
const OUTPUT_RE =
  /\b(responde|formato|viñetas|bullets|json|tabla|max(?:imo|imum)?|palabras|words|preámbulo|preamble|output)\b/i;
const ROLE_RE =
  /\b(eres un|eres una|you are a|you are an|actúa como|actua como|act as)\b/i;

function sentences(text) {
  return String(text ?? "")
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dedupeSentences(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function shouldStructure(text, mode) {
  const parts = sentences(text);
  if (parts.length >= 2) return true;
  if (mode === "system") return true;
  return CONSTRAINT_RE.test(text) || OUTPUT_RE.test(text) || ROLE_RE.test(text);
}

export function structureText(text, mode = "message") {
  const source = normalizeWhitespace(text);
  if (!source) return source;

  const parts = dedupeSentences(sentences(source));
  const role = [];
  const constraints = [];
  const output = [];
  const goal = [];
  const rest = [];

  for (const part of parts) {
    if (ROLE_RE.test(part) && role.length === 0) {
      role.push(part.replace(ROLE_RE, "").replace(/^[\s,.:-]+/, "").trim() || part);
      continue;
    }
    if (CONSTRAINT_RE.test(part)) {
      constraints.push(part);
      continue;
    }
    if (OUTPUT_RE.test(part)) {
      output.push(part);
      continue;
    }
    if (goal.length === 0) {
      goal.push(part);
      continue;
    }
    rest.push(part);
  }

  if (!shouldStructure(source, mode) && mode === "message") {
    return source;
  }

  const lines = [];
  if (mode === "system" && role.length) lines.push(`ROLE: ${role.join(" ")}`);
  if (goal.length) lines.push(`GOAL: ${goal.join(" ")}`);
  if (rest.length) lines.push(`INPUT: ${rest.join(" ")}`);
  if (constraints.length) lines.push(`CONSTRAINTS:\n- ${constraints.join("\n- ")}`);
  if (output.length) lines.push(`OUTPUT: ${output.join(" ")}`);

  return lines.length ? lines.join("\n") : source;
}
