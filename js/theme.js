const STORAGE_KEY = "tokemin-theme";
const LEGACY_KEY = "promptmin-theme";

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  for (const input of document.querySelectorAll(".theme-switcher__input")) {
    input.checked = input.value === theme;
  }
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY) ?? "dark";
  setTheme(saved);
  for (const input of document.querySelectorAll(".theme-switcher__input")) {
    input.addEventListener("change", () => setTheme(input.value));
  }
}
