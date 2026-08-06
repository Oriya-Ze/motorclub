import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { StoriesBarSkeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";

export default function StoriesBar() {
  const { data: stories = [], isLoading, isFetching } = useQuery({
    queryKey: ["stories"],
    queryFn: () => api.getStories(),
    refetchInterval: 60000,
  });

  if ((isLoading || isFetching) && stories.length === 0) {
    return <StoriesBarSkeleton />;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      <Link
        to="/stories/create"
        className="flex flex-col items-center gap-1 shrink-0"
      >
        <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/50 flex items-center justify-center bg-muted/30">
          <Plus className="w-6 h-6 text-primary" />
        </div>
        <span className="text-[10px] text-muted-foreground">Story</span>
      </Link>

      {stories.map((story) => (
        <Link
          key={story.id}
          to={`/stories/${story.id}`}
          className="flex flex-col items-center gap-1 shrink-0"
        >
          <div className={cn("w-16 h-16 rounded-full p-0.5 gradient-primary")}>
            <div className="w-full h-full rounded-full overflow-hidden bg-card border-2 border-card">
              {story.media_type === "image" ? (
                <img src={mediaUrl(story.media_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-primary flex items-center justify-center text-white text-lg font-bold">
                  {story.author.full_name[0]}
                </div>
              )}
            </div>
          </div>
          <span className="text-[10px] max-w-[64px] truncate">{story.author.username}</span>
        </Link>
      ))}
    </div>
  );
}
