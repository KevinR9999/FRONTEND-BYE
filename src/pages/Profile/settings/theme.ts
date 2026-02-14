export type ThemeMode = "light" | "dark" | "system";

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;

  root.classList.toggle("dark", resolved === "dark");
  localStorage.setItem("bye_theme", theme);
}
