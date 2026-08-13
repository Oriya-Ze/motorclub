export type Theme = "dark" | "light";

const STORAGE_KEY = "motorclub_theme";

const THEME_COLORS: Record<Theme, string> = {
  dark: "#141418",
  light: "#FAFAFA",
};

function updateThemeColorMeta(theme: Theme) {
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLORS[theme];
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
  updateThemeColorMeta(theme);
}

export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : null;
}

export function initTheme() {
  applyTheme(getStoredTheme() ?? "dark");
}
