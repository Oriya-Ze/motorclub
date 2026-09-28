const ALLOWED_PREFIXES = ["/marketplace", "/services", "/profile", "/posts", "/explore", "/"];

export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return null;
  const path = value.split(/[?#]/)[0];
  if (path.includes("/services/") && value.includes("from=")) return null;
  const allowed = path === "/" || ALLOWED_PREFIXES.some((prefix) => prefix !== "/" && (path === prefix || path.startsWith(`${prefix}/`)));
  return allowed ? value : null;
}

export function withReturnTo(path: string, from?: string | null): string {
  const safe = safeReturnTo(from);
  if (!safe) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}from=${encodeURIComponent(safe)}`;
}
