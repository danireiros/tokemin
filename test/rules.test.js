import assert from "node:assert/strict";
import { test } from "node:test";
import { compress } from "../core/pipeline.js";
import { collectRiskTokens, stripFillers } from "../core/rules.js";
import { protectBlocks, restoreBlocks } from "../core/protect.js";
import { splitChatTurns } from "../core/extractive.js";

test("quita cortesía en español y deja la tarea", () => {
  const result = compress(
    "Hola, ¿podrías por favor ayudarme a revisar este código y listar los errores? Gracias de antemano.",
    { mode: "message", aggressiveness: "soft" },
  );
  assert.match(result.text, /revisar|listar|errores|código|codigo/i);
  assert.doesNotMatch(result.text, /por favor|gracias de antemano|podrías/i);
  assert.ok(result.tokensOut <= result.tokensIn);
});

test("conserva negaciones", () => {
  const result = compress(
    "Por favor no borres los comentarios excepto los de debug.",
    { mode: "message", aggressiveness: "soft" },
  );
  assert.match(result.text, /\bno\b/i);
  assert.match(result.text, /excepto/i);
  const risks = collectRiskTokens(result.text);
  assert.ok(risks.negations.length >= 1);
});

test("no toca un code fence", () => {
  const source = "Por favor resume esto:\n```js\nconst please = 1; // keep\n```\n";
  const result = compress(source, { mode: "message", aggressiveness: "medium", protectCode: true });
  assert.match(result.text, /```js/);
  assert.match(result.text, /const please = 1/);
});

test("protect/restore redondea URLs y fences", () => {
  const source = "Lee https://example.com/docs y esto:\n```\nkeep please\n```";
  const { text, blocks } = protectBlocks(source, { protectCode: true });
  assert.doesNotMatch(text, /example\.com/);
  assert.equal(restoreBlocks(text, blocks), source);
});

test("aviso si el prompt es corto", () => {
  const result = compress("Resume esto.", { mode: "message", aggressiveness: "soft" });
  assert.equal(result.residual, true);
  assert.ok(result.warnings.some((item) => /corto|residual/i.test(item)));
});

test("fillers EN no se comen un please aislado dentro de código protegido", () => {
  const cleaned = stripFillers("please review this");
  assert.doesNotMatch(cleaned, /please/i);
  assert.match(cleaned, /review this/i);
});

test("chat conserva los últimos turnos", () => {
  const source = [
    "User: primera pregunta larga sobre historia romana y detalles irrelevantes.",
    "Assistant: respuesta vieja.",
    "User: segunda.",
    "Assistant: ok.",
    "User: tercera actual",
    "Assistant: voy",
  ].join("\n");
  const turns = splitChatTurns(source);
  assert.equal(turns.length, 6);
  const result = compress(source, { mode: "chat", aggressiveness: "budget", budgetTokens: 120, keepLast: 2 });
  assert.match(result.text, /tercera actual|voy/i);
});
