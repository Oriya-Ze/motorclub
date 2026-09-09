import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import PostCard from "@/components/PostCard";
import { PostSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";

export default function PostPage() {
  const { t } = useTranslation();
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => api.getPost(postId!),
    enabled: !!postId,
  });

  if (isLoading) return <PostSkeleton variant="detail" />;

  if (isError || !post) {
    return (
      <div className="text-center py-16 space-y-4 px-4">
        <p className="text-muted-foreground">{t("postNotFound")}</p>
        <Link to="/explore" className="text-primary hover:underline">
          {t("explore")}
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-20 md:pb-8 w-full md:max-w-2xl md:mx-auto">
      <div className="sticky top-16 z-40 flex items-center gap-2 px-4 py-2.5 md:px-0 bg-background/85 backdrop-blur-md border-b border-border/40 md:static md:bg-transparent md:backdrop-blur-none md:border-0 md:mb-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground rounded-lg px-1 py-0.5"
        >
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          {t("back")}
        </button>
      </div>
      <PostCard post={post} variant="detail" onDeleted={() => navigate("/")} />
    </div>
  );
}
