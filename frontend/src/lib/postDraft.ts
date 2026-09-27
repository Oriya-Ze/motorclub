const STORAGE_PREFIX = "motorclub_post_draft_v1:";

export type PostStarter = "" | "update" | "mod" | "service" | "question";

export type DraftMediaStatus = "ready" | "failed";

export interface DraftMedia {
  id: string;
  kind: "image" | "video";
  name: string;
  status: DraftMediaStatus;
  reference?: string;
  originalReference?: string;
  error?: string;
}

export interface PostDraft {
  content: string;
  location: string;
  vehicleId: string;
  starter: PostStarter;
  media: DraftMedia[];
  savedAt: number;
}

function keyFor(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadPostDraft(userId: string): PostDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostDraft;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.media)) return null;
    return {
      content: typeof parsed.content === "string" ? parsed.content : "",
      location: typeof parsed.location === "string" ? parsed.location : "",
      vehicleId: typeof parsed.vehicleId === "string" ? parsed.vehicleId : "",
      starter: parsed.starter === "update" || parsed.starter === "mod" || parsed.starter === "service" || parsed.starter === "question" ? parsed.starter : "",
      media: parsed.media.filter((item) => item && typeof item.id === "string" && (item.kind === "image" || item.kind === "video")),
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function savePostDraft(userId: string, draft: Omit<PostDraft, "savedAt">): void {
  const payload: PostDraft = { ...draft, savedAt: Date.now() };
  localStorage.setItem(keyFor(userId), JSON.stringify(payload));
}

export function clearPostDraft(userId: string): void {
  localStorage.removeItem(keyFor(userId));
}
