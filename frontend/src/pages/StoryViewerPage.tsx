import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

export default function StoryViewerPage() {
  const { t } = useTranslation();
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ["stories"],
    queryFn: () => api.getStories(),
  });

  const index = stories.findIndex((s) => s.id === storyId);
  const story = index >= 0 ? stories[index] : null;
  const prev = index > 0 ? stories[index - 1] : null;
  const next = index >= 0 && index < stories.length - 1 ? stories[index + 1] : null;

  if (!isLoading && !story) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
        <p>{t("storyNotFound")}</p>
        <Link to="/" className="text-primary hover:underline">
          {t("backToFeed")}
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {story && (
            <>
              <span className="font-semibold truncate">{story.author.full_name}</span>
              <span className="text-white/60 text-sm truncate">@{story.author.username}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-white/10"
          aria-label={t("close")}
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-0">
        {isLoading || !story ? (
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : story.media_type === "video" ? (
          <video
            src={mediaUrl(story.media_url)}
            className="max-h-full max-w-full object-contain"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img
            src={mediaUrl(story.media_url)}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        )}

        {prev && (
          <Link
            to={`/stories/${prev.id}`}
            className="absolute start-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
            aria-label={t("previousStory")}
          >
            <ChevronLeft className="w-8 h-8" />
          </Link>
        )}
        {next && (
          <Link
            to={`/stories/${next.id}`}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
            aria-label={t("nextStory")}
          >
            <ChevronRight className="w-8 h-8" />
          </Link>
        )}
      </div>

      {story?.caption && (
        <p className="px-4 py-3 text-white text-sm text-center shrink-0">{story.caption}</p>
      )}
    </div>
  );
}
