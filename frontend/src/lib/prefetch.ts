import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

const PAGE_SIZE = 10;

function prefetchFeed(queryClient: QueryClient) {
  void queryClient.prefetchInfiniteQuery({
    queryKey: ["posts"],
    queryFn: ({ pageParam }) => api.getPosts({ skip: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
  });
  void queryClient.prefetchQuery({
    queryKey: ["stories"],
    queryFn: () => api.getStories(),
  });
}

/** Warm common caches after login so navigation feels instant. */
export function prefetchAppData(queryClient: QueryClient) {
  prefetchFeed(queryClient);
  void queryClient.prefetchQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });
}

const routePrefetch: Record<string, (qc: QueryClient) => void> = {
  "/": prefetchFeed,
  "/explore": (qc) => {
    void qc.prefetchQuery({ queryKey: ["explore-posts"], queryFn: () => api.explorePosts() });
    void qc.prefetchQuery({ queryKey: ["explore-vehicles"], queryFn: () => api.exploreVehicles() });
    void qc.prefetchQuery({ queryKey: ["trending-hashtags"], queryFn: () => api.trendingHashtags() });
  },
  "/services": (qc) => {
    void qc.prefetchQuery({ queryKey: ["services", "", ""], queryFn: () => api.getServices() });
  },
  "/garage": (qc) => {
    void qc.prefetchQuery({ queryKey: ["garage"], queryFn: () => api.getMyGarage() });
  },
  "/groups": (qc) => {
    void qc.prefetchQuery({ queryKey: ["groups"], queryFn: () => api.getGroups() });
  },
  "/community": (qc) => {
    void qc.prefetchQuery({ queryKey: ["groups"], queryFn: () => api.getGroups() });
    void qc.prefetchQuery({ queryKey: ["forums"], queryFn: () => api.getForums() });
  },
  "/forums": (qc) => {
    void qc.prefetchQuery({ queryKey: ["forums"], queryFn: () => api.getForums() });
  },
  "/events": (qc) => {
    void qc.prefetchQuery({ queryKey: ["events"], queryFn: () => api.getEvents() });
  },
  "/marketplace": (qc) => {
    void qc.prefetchQuery({ queryKey: ["products", ""], queryFn: () => api.getProducts({}) });
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
