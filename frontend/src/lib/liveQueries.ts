import { api } from "@/lib/api";

/**
 * Counters shown on every page. Layout is the only component that polls them; the header and the side
 * button read the same cache, because each component with its own refetchInterval adds its own timer.
 */
export const LIVE_POLL_MS = 30_000;

export const unreadCountQuery = {
  queryKey: ["unread-count"],
  queryFn: () => api.getUnreadCount(),
} as const;

export const conversationsQuery = {
  queryKey: ["conversations"],
  queryFn: () => api.getConversations(),
} as const;
