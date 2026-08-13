export type Theme = "dark" | "light";

const STORAGE_KEY = "motorclub_theme";

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
}

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function initTheme() {
  applyTheme(getStoredTheme() ?? "dark");
}
