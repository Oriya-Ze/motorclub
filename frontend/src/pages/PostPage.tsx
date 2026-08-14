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

  if (isLoading) return <PostSkeleton />;

  if (isError || !post) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">{t("postNotFound")}</p>
        <Link to="/explore" className="text-primary hover:underline">
          {t("explore")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-20 md:pb-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="w-4 h-4" />
        {t("back")}
      </button>
      <PostCard post={post} onDeleted={() => navigate("/explore")} />
    </div>
  );
}
