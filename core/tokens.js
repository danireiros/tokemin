let preciseCount = null;

export function setPreciseCounter(fn) {
  preciseCount = typeof fn === "function" ? fn : null;
}

export function hasPreciseCounter() {
  return typeof preciseCount === "function";
}

export function estimateTokens(text) {
  const value = String(text ?? "");
  if (!value) return 0;

  const words = value.trim().match(/\S+/g) || [];
  const letters = (value.match(/[\p{L}]/gu) || []).length;
  const spanish = (value.match(/[áéíóúñüÁÉÍÓÚÑÜ]/g) || []).length;
  const cjk = (value.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) || []).length;
  const other = Math.max(0, value.length - letters - (value.match(/\s/g) || []).length - cjk);

  const wordWeight = spanish > 0 ? 1.28 : 1.12;
  return Math.max(1, Math.round(words.length * wordWeight + cjk + other * 0.35));
}

export function countTokens(text) {
  if (preciseCount) {
    try {
      const n = preciseCount(text);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    } catch {
      // fall through to heuristic
    }
  }
  return estimateTokens(text);
}

export const MODEL_PRICES = {
  "gpt-4o": { label: "GPT-4o (proxy o200k)", input: 2.5, output: 10 },
  "gpt-4.1": { label: "GPT-4.1 (proxy o200k)", input: 2, output: 8 },
  "claude-sonnet": { label: "Claude Sonnet (aprox.)", input: 3, output: 15 },
  "gemini-flash": { label: "Gemini Flash (aprox.)", input: 0.15, output: 0.6 },
};

export function estimateCostUsd(tokens, model = "gpt-4o", kind = "input") {
  const row = MODEL_PRICES[model] ?? MODEL_PRICES["gpt-4o"];
  const perMillion = kind === "output" ? row.output : row.input;
  return (tokens / 1_000_000) * perMillion;
}

export function savingsPerThousandCalls(tokensIn, tokensOut, model = "gpt-4o") {
  const saved = Math.max(0, tokensIn - tokensOut);
  return estimateCostUsd(saved, model, "input") * 1000;
}
