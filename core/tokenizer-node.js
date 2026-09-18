import { setPreciseCounter } from "./tokens.js";

export async function initNodeTokenizer(encoding = "o200k_base") {
  try {
    const mod = encoding === "cl100k_base"
      ? await import("gpt-tokenizer/encoding/cl100k_base")
      : await import("gpt-tokenizer/encoding/o200k_base");
    setPreciseCounter((text) => mod.encode(String(text ?? "")).length);
    return true;
  } catch {
    setPreciseCounter(null);
    return false;
  }
}
