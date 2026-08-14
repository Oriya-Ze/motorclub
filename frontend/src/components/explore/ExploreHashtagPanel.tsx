import { Hash, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import { HashtagRowSkeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";

export interface HashtagItem {
  tag: string;
  count: number;
}

interface ExploreHashtagPanelProps {
  hashtags: HashtagItem[];
  isLoading?: boolean;
}

export default function ExploreHashtagPanel({ hashtags, isLoading }: ExploreHashtagPanelProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase().replace(/^#/, "");
    if (!q) return hashtags;
    return hashtags.filter((h) => h.tag.toLowerCase().includes(q));
  }, [hashtags, filter]);

  const featured = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  if (isLoading) {
    return <HashtagRowSkeleton />;
  }

  if (hashtags.length === 0) {
    return (
      <EmptyState
        icon={Hash}
        title={t("exploreHashtagsEmpty")}
        description={t("exploreHashtagsEmptyDesc")}
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("exploreSearchTags")}
          className="w-full h-10 bg-muted/30 border border-border rounded-xl ps-9 pe-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t("exploreNoMatchingTags")}</p>
      ) : (
        <>
          {featured.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {featured.map((h, idx) => (
                <Link
                  key={h.tag}
                  to={`/explore?tag=${encodeURIComponent(h.tag)}`}
                  className={cn(
                    "glass-card rounded-xl p-4 hover:shadow-glow transition-shadow",
                    idx === 0 && "sm:col-span-1 ring-1 ring-primary/15"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                    <span className="text-xs text-muted-foreground">{h.count}</span>
                  </div>
                  <p className="font-display text-xl tracking-wide text-primary mt-1 truncate">#{h.tag}</p>
                </Link>
              ))}
            </div>
          )}

          {rest.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {rest.map((h) => (
                <Link
                  key={h.tag}
                  to={`/explore?tag=${encodeURIComponent(h.tag)}`}
                  className="shrink-0 px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  #{h.tag}
                  <span className="text-xs opacity-70 ms-1">({h.count})</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
