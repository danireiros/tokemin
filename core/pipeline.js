import { protectBlocks, restoreBlocks } from "./protect.js";
import {
  collectRiskTokens,
  normalizeWhitespace,
  stripCodeComments,
  stripDecorative,
  stripFillers,
  toDenseEnglish,
} from "./rules.js";
import { structureText } from "./structure.js";
import { compressChat, extractToBudget } from "./extractive.js";
import { countTokens } from "./tokens.js";

export const MODES = ["message", "system", "context", "chat"];
export const AGGRESSIVENESS = ["soft", "medium", "hard", "budget"];
export const SHORT_PROMPT_LIMIT = 80;

const SHORT_OUTPUT = "OUTPUT: bullets. max 120 words. no preamble.";

function missingTokens(before, after) {
  const lost = [];
  for (const [group, list] of Object.entries(before)) {
    for (const token of list) {
      const found = after[group].some((item) => item.toLowerCase() === token.toLowerCase());
      if (!found) lost.push(token);
    }
  }
  return [...new Set(lost)];
}

export function resolveLayers(mode, aggressiveness) {
  const hard = aggressiveness === "hard" || aggressiveness === "budget";
  return {
    normalize: true,
    fillers: true,
    structure: aggressiveness === "medium" || hard,
    extractive: mode === "context" || mode === "chat" || aggressiveness === "budget" || (hard && mode !== "message"),
    extractiveMessage: hard && mode === "message",
  };
}

export function compress(text, options = {}) {
  const mode = MODES.includes(options.mode) ? options.mode : "message";
  const aggressiveness = AGGRESSIVENESS.includes(options.aggressiveness)
    ? options.aggressiveness
    : "medium";
  const protectCode = options.protectCode !== false;
  const shortOutput = Boolean(options.shortOutput);
  const denseEnglish = Boolean(options.denseEnglish);
  const stripComments = Boolean(options.stripCodeComments);
  const query = String(options.query ?? "");
  const budgetTokens = Number(options.budgetTokens) > 0 ? Number(options.budgetTokens) : 800;
  const layers = resolveLayers(mode, aggressiveness);

  const original = String(text ?? "");
  const warnings = [];
  const tokensIn = countTokens(original);

  if (!original.trim()) {
    return {
      text: "",
      tokensIn: 0,
      tokensOut: 0,
      ratio: 1,
      saved: 0,
      warnings: [],
      residual: true,
      mode,
      aggressiveness,
    };
  }

  if (tokensIn < SHORT_PROMPT_LIMIT) {
    warnings.push("Este texto es corto: el ahorro suele ser residual.");
  }

  let working = original;
  if (stripComments) working = stripCodeComments(working);

  const protectedWork = protectBlocks(working, { protectCode });
  working = protectedWork.text;

  if (layers.normalize) {
    working = stripDecorative(working);
    working = normalizeWhitespace(working);
  }
  if (layers.fillers) {
    working = stripFillers(working);
  }
  if (denseEnglish) {
    working = toDenseEnglish(working);
  }

  if (mode === "chat") {
    working = compressChat(working, {
      budgetTokens,
      query,
      keepLast: options.keepLast,
    });
  } else if (layers.extractive && mode === "context") {
    working = extractToBudget(working, { budgetTokens, query });
  } else if (layers.extractiveMessage) {
    working = extractToBudget(working, {
      budgetTokens: Math.min(budgetTokens, Math.max(40, Math.round(tokensIn * 0.55))),
      query,
    });
  } else if (layers.extractive && mode === "system") {
    working = extractToBudget(working, {
      budgetTokens: aggressiveness === "budget" ? budgetTokens : Math.max(budgetTokens, 400),
      query,
    });
  }

  if (layers.structure && mode !== "context" && mode !== "chat") {
    const structured = structureText(working, mode);
    if (countTokens(structured) <= countTokens(working)) {
      working = structured;
    }
  }

  working = restoreBlocks(working, protectedWork.blocks);
  working = normalizeWhitespace(working);

  if (shortOutput && !/OUTPUT:\s*bullets/i.test(working)) {
    working = `${working}\n\n${SHORT_OUTPUT}`;
  }

  const tokensOut = countTokens(working);
  const lost = missingTokens(collectRiskTokens(original), collectRiskTokens(working));
  if (lost.length) {
    warnings.push(`Revisa si se perdieron: ${lost.slice(0, 8).join(", ")}.`);
  }

  return {
    text: working,
    tokensIn,
    tokensOut,
    ratio: tokensIn ? tokensOut / tokensIn : 1,
    saved: Math.max(0, tokensIn - tokensOut),
    warnings,
    residual: tokensIn < SHORT_PROMPT_LIMIT,
    mode,
    aggressiveness,
  };
}

export const TEMPLATES = {
  review: "Review the code. List bugs, risks, and concrete patches. No preamble.",
  translate: "Translate to English. Keep meaning. No commentary.",
  summarize: "Summarize. Bullets. Facts only. Max 12 lines.",
};
