import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Hash, Search, Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import BusinessCard from "@/components/BusinessCard";
import EmptyState from "@/components/EmptyState";
import ExploreSearchResults from "@/components/explore/ExploreSearchResults";
import ExplorePhotoGrid from "@/components/explore/ExplorePhotoGrid";
import ExploreTabs from "@/components/explore/ExploreTabs";
import ExploreVehicleGrid from "@/components/explore/ExploreVehicleGrid";
import { parseExploreTab, type ExploreTab } from "@/components/explore/types";
import PageHeading from "@/components/PageHeading";
import { ListPageSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { pickStoredImageUrl } from "@/lib/postMedia";

export default function ExplorePage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [vehicleQuery, setVehicleQuery] = useState("");
  const vehicleSearch = vehicleQuery.trim();
  const tag = params.get("tag")?.trim() || "";
  const tab = parseExploreTab(params.get("tab"));
  // The search lives in the URL (?q=), so going back from a result returns to the same results.
  const urlQuery = params.get("q") ?? "";
  const [searchText, setSearchText] = useState(urlQuery);
  const search = urlQuery.trim();
  const searching = search.length >= 2;

  useEffect(() => setSearchText(urlQuery), [urlQuery]);

  useEffect(() => {
    if (searchText === urlQuery) return;
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      if (searchText.trim()) next.set("q", searchText);
      else next.delete("q");
      setParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: explorePosts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["explore-posts"],
    queryFn: () => api.explorePosts(),
  });

  const { data: businesses = [], isLoading: businessesLoading } = useQuery({
    queryKey: ["services", "", ""],
    queryFn: () => api.getServices({}),
    enabled: tab === "businesses" && !searching,
  });

  const { data: searchedVehicles = [], isLoading: searchLoading } = useQuery({
    queryKey: ["garage-search", vehicleSearch],
    queryFn: () => api.searchVehicles(vehicleSearch),
    enabled: tab === "vehicles" && vehicleSearch.length >= 2,
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["explore-vehicles"],
    queryFn: () => api.exploreVehicles(),
    enabled: tab === "vehicles" && !searching,
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

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={t("exploreSearch.placeholder")}
          aria-label={t("exploreSearch.label")}
          enterKeyHint="search"
          className="h-11 ps-9 pe-10"
        />
        {searchText && (
          <button
            type="button"
            onClick={() => setSearchText("")}
            aria-label={t("exploreSearch.clear")}
            className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {searching ? (
        <ExploreSearchResults key={search} query={search} />
      ) : (
      <>
      {search.length === 1 && <p className="text-sm text-muted-foreground">{t("exploreSearch.minChars")}</p>}

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
          <Input
            value={vehicleQuery}
            onChange={(e) => setVehicleQuery(e.target.value)}
            placeholder={t("garage.searchVehicles")}
            className="h-11"
          />
          <ExploreVehicleGrid
            vehicles={
              vehicleSearch.length >= 2
                ? searchedVehicles.map((v) => ({
                    id: v.id,
                    make: v.make,
                    model: v.model,
                    year: v.year,
                    nickname: v.nickname,
                    thumbnail: pickStoredImageUrl(v.image_urls?.[0], v.image_media, "feed") || undefined,
                    owner: v.owner,
                  }))
                : vehicles
            }
            isLoading={vehicleSearch.length >= 2 ? searchLoading : vehiclesLoading}
          />
        </section>
      )}

      {tab === "businesses" && (
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-wide">{t("exploreBusinesses")}</h2>
          {businessesLoading ? (
            <ListPageSkeleton rows={3} />
          ) : businesses.length === 0 ? (
            <EmptyState icon={Store} title={t("noServices")} className="py-12" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {businesses.map((business) => (
                <BusinessCard key={business.id} service={business} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "photos" && !postsLoading && explorePosts.length > 0 && (
        <div className="pt-2 flex flex-wrap gap-2 justify-center">
          <Button variant="outline" size="sm" onClick={() => setTab("vehicles")}>
            {t("exploreTabVehicles")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTab("businesses")}>
            {t("exploreTabBusinesses")}
          </Button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
