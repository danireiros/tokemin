import { initTheme } from "./theme.js";
import { renderDiff } from "./diff.js";
import {
  TEMPLATES,
  compress,
  countTokens,
  hasPreciseCounter,
  savingsPerThousandCalls,
  setPreciseCounter,
} from "../core/index.js";

const HISTORY_KEY = "promptmin-history";
const LEVELS = ["soft", "medium", "hard", "budget"];
const LEVEL_LABELS = ["suave", "media", "agresiva", "presupuesto"];

const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const queryText = document.getElementById("queryText");
const aggressiveness = document.getElementById("aggressiveness");
const budgetTokens = document.getElementById("budgetTokens");
const modelSelect = document.getElementById("modelSelect");
const chkProtect = document.getElementById("chkProtect");
const chkShort = document.getElementById("chkShort");
const chkDense = document.getElementById("chkDense");
const chkComments = document.getElementById("chkComments");
const diffView = document.getElementById("diffView");
const historyList = document.getElementById("historyList");

let mode = "message";
let timer = 0;

function options() {
  return {
    mode,
    aggressiveness: LEVELS[Number(aggressiveness.value)] ?? "medium",
    budgetTokens: Number(budgetTokens.value),
    query: queryText.value,
    protectCode: chkProtect.checked,
    shortOutput: chkShort.checked,
    denseEnglish: chkDense.checked,
    stripCodeComments: chkComments.checked,
  };
}

function formatMoney(value) {
  if (value < 0.01) return `${(value * 100).toFixed(2)} ¢`;
  return `${value.toFixed(2)} €`;
}

function refresh() {
  const source = inputText.value;
  const result = compress(source, options());
  if (document.activeElement !== outputText) {
    outputText.value = result.text;
  }
  document.getElementById("tokensIn").textContent = String(result.tokensIn);
  document.getElementById("tokensOut").textContent = String(result.tokensOut);
  document.getElementById("tokensSaved").textContent = `${result.saved} (${Math.round((1 - result.ratio) * 100)}%)`;
  document.getElementById("costSaved").textContent = formatMoney(
    savingsPerThousandCalls(result.tokensIn, result.tokensOut, modelSelect.value),
  );
  document.getElementById("inputChars").textContent = `${source.length} c`;
  document.getElementById("countSource").textContent = hasPreciseCounter()
    ? "o200k / cl100k"
    : "heurístico (proxy)";
  document.getElementById("aggressivenessValue").textContent = LEVEL_LABELS[Number(aggressiveness.value)];
  document.getElementById("budgetValue").textContent = String(budgetTokens.value);

  const warningRow = document.getElementById("warningRow");
  const warningText = document.getElementById("warningText");
  if (result.warnings.length) {
    warningRow.hidden = false;
    warningText.textContent = result.warnings[0];
  } else {
    warningRow.hidden = true;
    warningText.textContent = "";
  }

  diffView.innerHTML = source.trim()
    ? renderDiff(source, result.text)
    : "El recorte aparece aquí: tachado lo que sobra, resaltado lo nuevo.";
}

function scheduleRefresh() {
  window.clearTimeout(timer);
  timer = window.setTimeout(refresh, 80);
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function renderHistory() {
  const items = loadHistory();
  historyList.innerHTML = "";
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    button.textContent = `${item.mode} · ${item.tokensIn}→${item.tokensOut} · ${item.preview}`;
    button.addEventListener("click", () => {
      inputText.value = item.input;
      refresh();
    });
    historyList.append(button);
  }
}

function saveHistory() {
  if (!inputText.value.trim()) return;
  const result = compress(inputText.value, options());
  const preview = (inputText.value.trim().slice(0, 72) || "vacío").replace(/\s+/g, " ");
  const next = [
    {
      mode: result.mode,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      preview,
      input: inputText.value.slice(0, 20_000),
    },
    ...loadHistory(),
  ].slice(0, 12);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  renderHistory();
}

async function loadTokenizer() {
  const encoding = modelSelect.value.startsWith("gpt-4") && modelSelect.value !== "gpt-4o" && modelSelect.value !== "gpt-4.1"
    ? "cl100k_base"
    : "o200k_base";
  const useLegacy = modelSelect.value === "legacy";
  const file = useLegacy ? "cl100k_base.js" : `${encoding}.js`;
  try {
    const mod = await import(`https://unpkg.com/gpt-tokenizer@2.9.0/esm/encoding/${file}`);
    setPreciseCounter((text) => mod.encode(text).length);
  } catch {
    setPreciseCounter(null);
  }
  refresh();
}

function bindModes() {
  for (const button of document.querySelectorAll("#modeRow [data-mode]")) {
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      for (const other of document.querySelectorAll("#modeRow [data-mode]")) {
        other.classList.toggle("is-active", other === button);
      }
      refresh();
    });
  }
}

function bindTemplates() {
  for (const button of document.querySelectorAll("[data-template]")) {
    button.addEventListener("click", () => {
      inputText.value = TEMPLATES[button.dataset.template] ?? inputText.value;
      refresh();
    });
  }
}

initTheme();
bindModes();
bindTemplates();
renderHistory();

inputText.addEventListener("input", scheduleRefresh);
queryText.addEventListener("input", scheduleRefresh);
aggressiveness.addEventListener("input", refresh);
budgetTokens.addEventListener("input", refresh);
modelSelect.addEventListener("change", () => {
  loadTokenizer();
});
chkProtect.addEventListener("change", refresh);
chkShort.addEventListener("change", refresh);
chkDense.addEventListener("change", refresh);
chkComments.addEventListener("change", refresh);
outputText.addEventListener("input", () => {
  document.getElementById("tokensOut").textContent = String(countTokens(outputText.value));
});

document.getElementById("btnCopy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(outputText.value);
  document.getElementById("btnCopy").textContent = "Copiado";
  window.setTimeout(() => {
    document.getElementById("btnCopy").textContent = "Copiar";
  }, 1200);
});

document.getElementById("btnSave").addEventListener("click", saveHistory);

loadTokenizer();
refresh();
