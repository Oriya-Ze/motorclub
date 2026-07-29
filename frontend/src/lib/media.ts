const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1").replace("/api/v1", "");

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

export { API_BASE };
