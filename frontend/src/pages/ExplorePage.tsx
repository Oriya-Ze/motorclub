import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Hash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import ExploreHashtagPanel from "@/components/explore/ExploreHashtagPanel";
import ExplorePhotoGrid from "@/components/explore/ExplorePhotoGrid";
import ExploreTabs from "@/components/explore/ExploreTabs";
import ExploreVehicleCarousel from "@/components/explore/ExploreVehicleCarousel";
import { parseExploreTab, type ExploreTab } from "@/components/explore/types";
import PageHeading from "@/components/PageHeading";
import UserSearch from "@/components/UserSearch";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

export default function ExplorePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tag = params.get("tag")?.trim() || "";
  const tab = parseExploreTab(params.get("tab"));

  const { data: explorePosts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["explore-posts"],
    queryFn: () => api.explorePosts(),
  });

  const { data: hashtags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => api.trendingHashtags(),
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["explore-vehicles"],
    queryFn: () => api.exploreVehicles(),
  });

  const { data: tagPosts = [], isLoading: tagPostsLoading } = useQuery({
    queryKey: ["posts", "tag", tag],
    queryFn: () => api.getPosts({ hashtag: tag }),
    enabled: !!tag,
  });

  const setTab = (next: ExploreTab) => {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", next);
    nextParams.delete("tag");
    setParams(nextParams, { replace: true });
  };

  const clearTag = () => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("tag");
    if (!nextParams.get("tab")) nextParams.set("tab", "tags");
    setParams(nextParams, { replace: true });
  };

  if (tag) {
    const imagePosts = tagPosts.filter((p) => p.image_urls?.[0]);
    const postCountLabel =
      tagPosts.length === 1
        ? t("exploreTagPosts_one")
        : t("exploreTagPosts", { count: tagPosts.length });

    return (
      <div className="space-y-5 pb-20 md:pb-6 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={clearTag}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
          {t("exploreBackToTags")}
        </button>

        <header className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display tracking-wide flex items-center gap-2">
            <Hash className="w-6 h-6 text-primary shrink-0" />
            #{tag}
          </h1>
          {!tagPostsLoading && <p className="text-sm text-muted-foreground">{postCountLabel}</p>}
        </header>

        <ExplorePhotoGrid
          posts={imagePosts}
          isLoading={tagPostsLoading}
          emptyAction="none"
          emptyTitle={t("exploreTagEmpty", { tag })}
          emptyDescription={undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-20 md:pb-6 max-w-2xl mx-auto">
      <PageHeading subtitle={t("exploreSubtitle")}>{t("explore")}</PageHeading>

      <div className="md:hidden">
        <UserSearch />
      </div>

      <ExploreTabs active={tab} onChange={setTab} />

      {tab === "photos" && (
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wide">{t("explorePhotos")}</h2>
          <ExplorePhotoGrid posts={explorePosts} isLoading={postsLoading} />
        </section>
      )}

      {tab === "vehicles" && (
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wide">{t("exploreGarages")}</h2>
          <ExploreVehicleCarousel vehicles={vehicles} isLoading={vehiclesLoading} />
        </section>
      )}

      {tab === "tags" && (
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wide">{t("trendingHashtags")}</h2>
          <ExploreHashtagPanel hashtags={hashtags} isLoading={tagsLoading} />
        </section>
      )}

      {tab === "photos" && !postsLoading && explorePosts.length > 0 && (
        <div className="pt-2 flex flex-wrap gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => setTab("vehicles")}>
            {t("exploreTabVehicles")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTab("tags")}>
            {t("exploreTabTags")}
          </Button>
        </div>
      )}
    </div>
  );
}
