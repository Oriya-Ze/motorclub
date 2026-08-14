import { useInfiniteQuery } from "@tanstack/react-query";
import { Car } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import BrandedSpinner from "@/components/BrandedSpinner";
import EmptyState from "@/components/EmptyState";
import FeedSidebar from "@/components/FeedSidebar";
import PostCard from "@/components/PostCard";
import StoriesBar from "@/components/StoriesBar";
import { PostSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

const PAGE_SIZE = 10;

export default function FeedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts"],
    queryFn: ({ pageParam }) => api.getPosts({ skip: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _all, lastParam) =>
      lastPage.length < PAGE_SIZE ? undefined : lastParam + PAGE_SIZE,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const posts = data?.pages.flat() ?? [];

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 justify-center">
      <div className="w-full lg:w-[min(100%,42rem)] space-y-4 pb-2">
        <StoriesBar />

        {isLoading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Car}
            title={t("noPostsTitle")}
            description={t("noPostsDesc")}
            action={
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <Button onClick={() => navigate("/", { state: { openCreatePost: true } })}>
                  {t("emptyFeedCtaPost")}
                </Button>
                <Button variant="outline" onClick={() => navigate("/garage")}>
                  {t("emptyFeedCtaGarage")}
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
              {isFetchingNextPage && <BrandedSpinner size="sm" />}
            </div>
          </>
        )}
      </div>
      <FeedSidebar />
    </div>
  );
}
