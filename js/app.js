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

const HISTORY_KEY = "tokemin-history";
const LEGACY_HISTORY_KEY = "promptmin-history";
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
const savingsChart = document.getElementById("savingsChart");
const btnCopy = document.getElementById("btnCopy");
const btnClearHistory = document.getElementById("btnClearHistory");

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

function normalizeItem(item) {
  const tokensIn = Number(item?.tokensIn) || 0;
  const tokensOut = Number(item?.tokensOut) || 0;
  const saved =
    item?.saved == null ? Math.max(0, tokensIn - tokensOut) : Math.max(0, Number(item.saved) || 0);
  const pct = tokensIn ? Math.round((saved / tokensIn) * 100) : 0;
  return {
    mode: item?.mode ?? "message",
    tokensIn,
    tokensOut,
    saved,
    pct,
    preview: item?.preview ?? "",
    input: item?.input ?? "",
    at: Number(item?.at) || 0,
  };
}

function formatWhen(ts) {
  if (!ts) return "";
  const delta = Date.now() - ts;
  if (delta < 60_000) return "ahora";
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return new Date(ts).toLocaleDateString();
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || localStorage.getItem(LEGACY_HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(normalizeItem) : [];
  } catch {
    return [];
  }
}

function renderHistory() {
  const items = loadHistory();
  const totalSaved = items.reduce((sum, item) => sum + item.saved, 0);
  const withIn = items.filter((item) => item.tokensIn > 0);
  const avg = withIn.length
    ? Math.round(withIn.reduce((sum, item) => sum + item.pct, 0) / withIn.length)
    : 0;

  document.getElementById("histCount").textContent = String(items.length);
  document.getElementById("histSaved").textContent = String(totalSaved);
  document.getElementById("histAvg").textContent = `${avg}%`;

  savingsChart.replaceChildren();
  const chronological = [...items].reverse();
  const maxSaved = chronological.reduce((max, item) => Math.max(max, item.saved), 0);
  for (const item of chronological) {
    const bar = document.createElement("span");
    bar.className = "chart-bar";
    const height = item.saved > 0 && maxSaved ? Math.max(6, (item.saved / maxSaved) * 100) : 0;
    bar.style.height = `${height}%`;
    bar.title = `−${item.saved} tokens · ${item.pct}%`;
    savingsChart.append(bar);
  }

  historyList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Aún no hay recortes guardados. Copia o guarda uno.";
    historyList.append(empty);
    return;
  }

  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";

    const preview = document.createElement("span");
    preview.textContent = item.preview;

    const meta = document.createElement("span");
    meta.className = "history-meta";
    const when = formatWhen(item.at);
    meta.textContent = when
      ? `−${item.saved} tokens · ${item.pct}% · ${item.mode} · ${when}`
      : `−${item.saved} tokens · ${item.pct}% · ${item.mode}`;

    const bar = document.createElement("div");
    bar.className = "history-bar";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(0, Math.min(100, item.pct))}%`;
    bar.append(fill);

    button.append(preview, meta, bar);
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
  const saved = Math.max(0, result.saved ?? result.tokensIn - result.tokensOut);
  const next = [
    normalizeItem({
      mode: result.mode,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      saved,
      preview,
      input: inputText.value.slice(0, 20_000),
      at: Date.now(),
    }),
    ...loadHistory(),
  ].slice(0, 24);
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

btnCopy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputText.value);
  } catch {
    return;
  }
  saveHistory();
  btnCopy.textContent = "Copiado";
  window.setTimeout(() => {
    btnCopy.textContent = "Copiar";
  }, 1200);
});

document.getElementById("btnSave").addEventListener("click", saveHistory);

btnClearHistory.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

loadTokenizer();
refresh();
