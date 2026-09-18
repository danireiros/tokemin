import assert from "node:assert/strict";
import { test } from "node:test";
import { compress } from "../core/pipeline.js";
import { extractToBudget } from "../core/extractive.js";

test("contexto cabe en el presupuesto y prioriza la pregunta", () => {
  const text = [
    "Los romanos construyeron acueductos en Hispania durante siglos.",
    "La receta de la tortilla lleva huevos, patatas y aceite.",
    "El presupuesto de tokens se mide con un encoder BPE.",
    "Tokemin recorta muletillas y contexto redundante para hablar más barato con un modelo.",
    "El clima de ayer fue nublado y no aporta nada a esta tarea.",
  ].join("\n\n");

  const extracted = extractToBudget(text, {
    budgetTokens: 40,
    query: "cómo recorta Tokemin los prompts",
  });
  assert.match(extracted, /Tokemin|tokens|muletillas/i);
  assert.doesNotMatch(extracted, /tortilla/);

  const result = compress(text, {
    mode: "context",
    aggressiveness: "budget",
    budgetTokens: 40,
    query: "cómo recorta Tokemin los prompts",
  });
  assert.ok(result.tokensOut <= 55);
});

test("system estructura reglas y no pierde el no", () => {
  const result = compress(
    "Eres un revisor de código. No inventes APIs. Responde en viñetas. Por favor sé amable.",
    { mode: "system", aggressiveness: "medium" },
  );
  assert.match(result.text, /\bno\b/i);
  assert.ok(result.tokensOut <= result.tokensIn);
});
