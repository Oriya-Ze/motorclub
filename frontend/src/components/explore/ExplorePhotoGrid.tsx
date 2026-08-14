import { Camera } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import { ExplorePhotoGridSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { User } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { displayName } from "@/lib/utils";

export interface ExplorePhotoItem {
  id: string;
  thumbnail?: string | null;
  image_urls?: string[] | null;
  author?: User | null;
}

interface ExplorePhotoGridProps {
  posts: ExplorePhotoItem[];
  isLoading?: boolean;
  previewCount?: number;
  emptyAction?: "post" | "none";
  emptyTitle?: string;
  emptyDescription?: string;
}

const DEFAULT_PREVIEW = 12;

function photoSrc(post: ExplorePhotoItem): string | undefined {
  return post.thumbnail || post.image_urls?.[0] || undefined;
}

export default function ExplorePhotoGrid({
  posts,
  isLoading,
  previewCount = DEFAULT_PREVIEW,
  emptyAction = "post",
  emptyTitle,
  emptyDescription,
}: ExplorePhotoGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const withImages = posts.filter((p) => photoSrc(p));
  const visible = expanded ? withImages : withImages.slice(0, previewCount);
  const hasMore = withImages.length > previewCount && !expanded;

  if (isLoading) {
    return <ExplorePhotoGridSkeleton />;
  }

  if (withImages.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title={emptyTitle ?? t("explorePhotosEmpty")}
        description={emptyDescription ?? t("explorePhotosEmptyDesc")}
        action={
          emptyAction === "post" ? (
            <Button onClick={() => navigate("/", { state: { openCreatePost: true } })}>
              {t("exploreCreatePost")}
            </Button>
          ) : undefined
        }
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {visible.map((post) => {
          const src = photoSrc(post)!;
          return (
            <Link
              key={post.id}
              to={`/posts/${post.id}`}
              className="group relative aspect-square bg-asphalt rounded-xl overflow-hidden ring-1 ring-border/40"
            >
              <img
                src={mediaUrl(src)}
                alt=""
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
              {post.author && (
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar user={post.author} size="xs" className="ring-1 ring-white/30" />
                    <span className="text-[11px] font-medium text-white truncate">
                      {displayName(post.author)}
                    </span>
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
            {t("exploreShowMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
