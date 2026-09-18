import { countTokens } from "./tokens.js";

function tokenize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);
}

function splitUnits(text) {
  const blocks = String(text ?? "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const units = [];
  for (const block of blocks) {
    const sentences = block.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length <= 2 || block.length < 280) {
      units.push(block);
    } else {
      units.push(...sentences);
    }
  }
  return units.length ? units : (text.trim() ? [text.trim()] : []);
}

function idfMap(units) {
  const df = new Map();
  for (const unit of units) {
    const unique = new Set(tokenize(unit));
    for (const word of unique) df.set(word, (df.get(word) || 0) + 1);
  }
  const n = Math.max(1, units.length);
  const idf = new Map();
  for (const [word, count] of df) {
    idf.set(word, Math.log((n + 1) / (count + 1)) + 1);
  }
  return idf;
}

function overlap(a, b) {
  if (!b.size) return 0;
  let hits = 0;
  for (const word of a) {
    if (b.has(word)) hits += 1;
  }
  return hits / b.size;
}

export function extractToBudget(text, { budgetTokens = 800, query = "" } = {}) {
  const units = splitUnits(text);
  if (!units.length) return "";

  const budget = Math.max(32, Number(budgetTokens) || 800);
  if (countTokens(text) <= budget) return String(text).trim();

  const idf = idfMap(units);
  const querySet = new Set(tokenize(query));

  const scored = units.map((unit, index) => {
    const words = tokenize(unit);
    const uniqueness = words.length
      ? words.reduce((sum, word) => sum + (idf.get(word) || 1), 0) / words.length
      : 0;
    const pos = index / Math.max(1, units.length - 1);
    const positionBoost = pos < 0.12 || pos > 0.88 ? 0.55 : 0;
    const queryScore = querySet.size ? overlap(new Set(words), querySet) : 0;
    return {
      index,
      unit,
      queryScore,
      score: queryScore * 6 + uniqueness + positionBoost,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const ranked = querySet.size && scored.some((item) => item.queryScore > 0)
    ? scored.filter((item) => item.queryScore > 0)
    : scored;

  const picked = new Set();
  let used = 0;
  for (const item of ranked) {
    const cost = countTokens(item.unit);
    if (picked.size && used + cost > budget) continue;
    picked.add(item.index);
    used += cost;
    if (used >= budget) break;
  }

  if (!picked.size) {
    return scored[0]?.unit ?? "";
  }

  return units.filter((_, index) => picked.has(index)).join("\n\n");
}

const TURN_RE =
  /^(?:#{1,3}\s*)?(?:\*\*)?(user|assistant|system|human|ai|chatgpt|you|yo|usuario|asistente)(?:\*\*)?\s*:/gim;

export function splitChatTurns(text) {
  const source = String(text ?? "");
  const matches = [...source.matchAll(TURN_RE)];
  if (!matches.length) return [];

  return matches.map((match, i) => {
    const start = match.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    return {
      role: match[1].toLowerCase(),
      text: source.slice(start, end).trim(),
    };
  });
}

export function compressChat(text, options = {}) {
  const keepLast = Number(options.keepLast) > 0 ? Number(options.keepLast) : 4;
  const turns = splitChatTurns(text);
  if (!turns.length) {
    return extractToBudget(text, options);
  }

  const recent = turns.slice(-keepLast);
  const older = turns.slice(0, Math.max(0, turns.length - keepLast));
  if (!older.length) {
    return recent.map((t) => t.text).join("\n\n");
  }

  const olderBudget = Math.max(
    80,
    Math.floor((Number(options.budgetTokens) || 800) * 0.45),
  );
  const olderText = extractToBudget(older.map((t) => t.text).join("\n\n"), {
    ...options,
    budgetTokens: olderBudget,
  });

  return [`CHAT_SUMMARY:\n${olderText}`, ...recent.map((t) => t.text)].join("\n\n");
}
