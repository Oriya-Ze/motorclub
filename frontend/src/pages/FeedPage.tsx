import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import PostCard from "@/components/PostCard";
import StoriesBar from "@/components/StoriesBar";
import { PostSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";

export default function FeedPage() {
  const { t } = useTranslation();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => api.getPosts(),
  });

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <StoriesBar />

      {isLoading ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-muted-foreground">{t("noPosts")}</p>
        </div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}
