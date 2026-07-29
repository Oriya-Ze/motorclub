const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1").replace("/api/v1", "");
const MEDIA_BASE_URL = (import.meta.env.VITE_MEDIA_BASE_URL || "").replace(/\/$/, "");

function isStorageKey(ref: string): boolean {
  return ref.startsWith("users/") && !ref.startsWith("/");
}

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/uploads/")) return `${API_BASE}${path}`;
  if (isStorageKey(path)) {
    if (!MEDIA_BASE_URL) {
      if (import.meta.env.DEV) {
        console.error(
          "[mediaUrl] VITE_MEDIA_BASE_URL is not configured; cannot resolve storage key:",
          path,
        );
      }
      return "";
    }
    return `${MEDIA_BASE_URL}/${path.replace(/^\//, "")}`;
  }
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export { API_BASE, MEDIA_BASE_URL };
