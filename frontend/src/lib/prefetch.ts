import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Warm common caches after login so navigation feels instant. */
export function prefetchAppData(queryClient: QueryClient) {
  void queryClient.prefetchQuery({
    queryKey: ["posts"],
    queryFn: () => api.getPosts(),
  });
  void queryClient.prefetchQuery({
    queryKey: ["stories"],
    queryFn: () => api.getStories(),
  });
  void queryClient.prefetchQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
}

const routePrefetch: Record<string, (qc: QueryClient) => void> = {
  "/": (qc) => {
    void qc.prefetchQuery({ queryKey: ["posts"], queryFn: () => api.getPosts() });
    void qc.prefetchQuery({ queryKey: ["stories"], queryFn: () => api.getStories() });
  },
  "/explore": (qc) => {
    void qc.prefetchQuery({ queryKey: ["explore-posts"], queryFn: () => api.explorePosts() });
    void qc.prefetchQuery({ queryKey: ["explore-vehicles"], queryFn: () => api.exploreVehicles() });
    void qc.prefetchQuery({ queryKey: ["trending-hashtags"], queryFn: () => api.trendingHashtags() });
  },
  "/garage": (qc) => {
    void qc.prefetchQuery({ queryKey: ["garage"], queryFn: () => api.getMyGarage() });
  },
  "/groups": (qc) => {
    void qc.prefetchQuery({ queryKey: ["groups"], queryFn: () => api.getGroups() });
  },
  "/events": (qc) => {
    void qc.prefetchQuery({ queryKey: ["events"], queryFn: () => api.getEvents() });
  },
  "/marketplace": (qc) => {
    void qc.prefetchQuery({ queryKey: ["products", ""], queryFn: () => api.getProducts() });
  },
  "/notifications": (qc) => {
    void qc.prefetchQuery({ queryKey: ["notifications"], queryFn: () => api.getNotifications() });
  },
  "/settings": (qc) => {
    void qc.prefetchQuery({ queryKey: ["settings"], queryFn: () => api.getSettings() });
  },
};

export function prefetchRoute(queryClient: QueryClient, path: string) {
  const prefetch = routePrefetch[path];
  if (prefetch) prefetch(queryClient);
}
