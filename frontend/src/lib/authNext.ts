const AUTH_NEXT_KEY = "motorclub_auth_next";

const ALLOWED_ROOTS = ["/marketplace", "/services", "/settings"];

export function safeInternalNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return null;
  }
  const path = value.split(/[?#]/)[0];
  const allowed = ALLOWED_ROOTS.some((root) => path === root || path.startsWith(`${root}/`));
  return allowed ? value : null;
}

export function rememberAuthNext(path: string | null) {
  try {
    if (path) sessionStorage.setItem(AUTH_NEXT_KEY, path);
    else sessionStorage.removeItem(AUTH_NEXT_KEY);
  } catch {
    // ignore storage failures
  }
}

export function takeAuthNext(): string | null {
  try {
    const value = safeInternalNext(sessionStorage.getItem(AUTH_NEXT_KEY));
    sessionStorage.removeItem(AUTH_NEXT_KEY);
    return value;
  } catch {
    return null;
  }
}

export type AuthIntent = "parts" | "publish" | "services" | "business";

export function authIntent(next: string | null): AuthIntent | null {
  if (!next) return null;
  const [path, query = ""] = next.split("?");
  const params = new URLSearchParams(query);
  if (path === "/marketplace" && params.get("create") === "1") return "publish";
  if (path === "/marketplace" || path.startsWith("/marketplace/")) return "parts";
  if (path === "/services" || path.startsWith("/services/")) return "services";
  if (path === "/settings" || path.startsWith("/settings/")) return "business";
  return null;
}
