import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flag, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReportDialog from "@/components/ReportDialog";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { displayName, formatHandle } from "@/lib/utils";

export default function StoryViewerPage() {
  const { t } = useTranslation();
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState(false);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ["stories"],
    queryFn: () => api.getStories(),
  });

  const index = stories.findIndex((s) => s.id === storyId);
  const story = index >= 0 ? stories[index] : null;
  const prev = index > 0 ? stories[index - 1] : null;
  const next = index >= 0 && index < stories.length - 1 ? stories[index + 1] : null;

  const deleteStory = useMutation({
    mutationFn: (id: string) => api.deleteStory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success(t("storyDeleted"));
      navigate("/", { replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
              <span className="font-semibold truncate">{displayName(story.author)}</span>
              <span className="text-white/60 text-sm truncate">{formatHandle(story.author)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {story && story.user_id !== user?.id && (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="p-2 rounded-full hover:bg-white/10"
              aria-label={t("reports.title")}
            >
              <Flag className="w-5 h-5" />
            </button>
          )}
          {story && story.user_id === user?.id && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(t("confirmDeleteStory"))) deleteStory.mutate(story.id);
              }}
              disabled={deleteStory.isPending}
              className="p-2 rounded-full hover:bg-white/10"
              aria-label={t("deleteStory")}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-white/10"
            aria-label={t("close")}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
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
      {reporting && story && <ReportDialog targetType="story" targetId={story.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
