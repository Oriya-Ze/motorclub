import { useQuery } from "@tanstack/react-query";
import { FileText, Hash, Play, SearchX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Avatar from "@/components/Avatar";
import BusinessCard from "@/components/BusinessCard";
import EmptyState from "@/components/EmptyState";
import ProductCard from "@/components/ProductCard";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/Button";
import ExploreVehicleGrid from "@/components/explore/ExploreVehicleGrid";
import { api, type ExploreSearchPost } from "@/lib/api";
import { getUserProfilePath } from "@/lib/businessProfile";
import { mediaUrl } from "@/lib/media";
import { pickStoredImageUrl } from "@/lib/postMedia";
import { cn, displayName, formatHandle } from "@/lib/utils";

const GROUPS = ["users", "businesses", "posts", "hashtags", "products", "vehicles"] as const;
type Group = (typeof GROUPS)[number];
type Filter = "all" | Group;
/** How many of each group the "all" view shows before "show all". */
const PREVIEW: Record<Group, number> = { users: 4, businesses: 2, posts: 6, hashtags: 8, products: 4, vehicles: 4 };

/**
 * Everything that matches one search: people, businesses, posts (photo, video or text), hashtags, products and
 * vehicles. Each group comes from the search that already applies its own visibility rules.
 */
export default function ExploreSearchResults({ query }: { query: string }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");

  const users = useQuery({ queryKey: ["explore-search", "users", query], queryFn: () => api.searchUsers(query) });
  const businesses = useQuery({ queryKey: ["explore-search", "businesses", query], queryFn: () => api.getServices({ q: query }) });
  const content = useQuery({ queryKey: ["explore-search", "content", query], queryFn: () => api.exploreSearch(query) });
  const products = useQuery({ queryKey: ["explore-search", "products", query], queryFn: () => api.getProducts({ q: query, limit: 24 }) });
  const vehicles = useQuery({ queryKey: ["explore-search", "vehicles", query], queryFn: () => api.searchVehicles(query) });

  const businessIds = new Set((businesses.data ?? []).map((business) => business.id));
  const lists = {
    // A business shows once, with its card, under businesses.
    users: (users.data ?? []).filter((user) => user.account_type !== "business" && !businessIds.has(user.id)),
    businesses: businesses.data ?? [],
    posts: content.data?.posts ?? [],
    hashtags: content.data?.hashtags ?? [],
    products: products.data?.items ?? [],
    vehicles: vehicles.data ?? [],
  };
  const pending = [users, businesses, content, products, vehicles].some((q) => q.isPending);
  const total = GROUPS.reduce((sum, group) => sum + lists[group].length, 0);
  const withResults = GROUPS.filter((group) => lists[group].length > 0);
  const shown = filter === "all" ? withResults : withResults.filter((group) => group === filter);

  if (!pending && total === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title={t("exploreSearch.noResults", { query })}
        description={t("exploreSearch.noResultsHint")}
        className="py-12"
      />
    );
  }

  const slice = <T,>(group: Group, items: T[]) => (filter === "all" ? items.slice(0, PREVIEW[group]) : items);

  const sections: Record<Group, () => ReactNode> = {
    users: () => (
      <ul className="divide-y divide-border/50 rounded-2xl border border-border/50">
        {slice("users", lists.users).map((user) => (
          <li key={user.id}>
            <Link to={getUserProfilePath(user)} className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-muted/40">
              <Avatar user={user} size="sm" />
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate text-sm font-medium">
                  {displayName(user)}
                  {user.is_verified && <VerifiedBadge className="h-3.5 w-3.5 shrink-0" />}
                </span>
                <span className="block truncate text-xs text-muted-foreground" dir="ltr">{formatHandle(user)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    ),
    businesses: () => (
      <div className="grid gap-3 sm:grid-cols-2">
        {slice("businesses", lists.businesses).map((business) => (
          <BusinessCard key={business.id} service={business} />
        ))}
      </div>
    ),
    posts: () => (
      <div className="grid grid-cols-3 gap-2">
        {slice("posts", lists.posts).map((post) => (
          <PostTile key={post.id} post={post} />
        ))}
      </div>
    ),
    hashtags: () => (
      <div className="flex flex-wrap gap-2">
        {slice("hashtags", lists.hashtags).map(({ tag, count }) => (
          <Link
            key={tag}
            to={`/explore?tag=${encodeURIComponent(tag)}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-card/60 px-3 text-sm hover:border-primary/50"
          >
            <Hash className="h-3.5 w-3.5 text-primary" aria-hidden />
            <span dir="auto">{tag}</span>
            <span className="text-xs text-muted-foreground">· {t("exploreSearch.postCount", { count })}</span>
          </Link>
        ))}
      </div>
    ),
    products: () => (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slice("products", lists.products).map((product) => (
          <Link
            key={product.id}
            to={product.vehicle_id ? `/vehicles/${product.vehicle_id}` : `/marketplace?product=${product.id}`}
            className="block min-w-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <ProductCard product={product} className="h-full" />
          </Link>
        ))}
      </div>
    ),
    vehicles: () => (
      <ExploreVehicleGrid
        vehicles={slice("vehicles", lists.vehicles).map((v) => ({
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          nickname: v.nickname,
          thumbnail: pickStoredImageUrl(v.image_urls?.[0], v.image_media, "feed") || undefined,
          owner: v.owner,
        }))}
      />
    ),
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label={t("exploreSearch.filter")}>
        {(["all", ...withResults] as Filter[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "min-h-9 shrink-0 rounded-full border px-3 text-sm transition-colors",
              filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {value === "all" ? t("exploreSearch.all", { count: total }) : `${t(`exploreSearch.groups.${value}`)} · ${lists[value].length}`}
          </button>
        ))}
      </div>

      {pending && <p role="status" className="text-sm text-muted-foreground">{t("exploreSearch.searching")}</p>}

      {shown.map((group) => (
        <section key={group} className="space-y-3" aria-labelledby={`explore-search-${group}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id={`explore-search-${group}`} className="font-display text-lg tracking-wide">
              {t(`exploreSearch.groups.${group}`)}
            </h2>
            {filter === "all" && lists[group].length > PREVIEW[group] && (
              <Button variant="ghost" size="sm" onClick={() => setFilter(group)}>
                {t("exploreSearch.showAll", { count: lists[group].length })}
              </Button>
            )}
          </div>
          {sections[group]()}
        </section>
      ))}
    </div>
  );
}

function PostTile({ post }: { post: ExploreSearchPost }) {
  const { t } = useTranslation();
  const label = post.content?.trim() || t("exploreSearch.postBy", { name: post.author ? displayName(post.author) : "" });
  if (post.kind === "video" && !post.thumbnail) {
    // A video still processing (or an old upload without a still frame) shows as a play tile.
    return (
      <Link
        to={`/posts/${post.id}`}
        aria-label={label}
        className="flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-asphalt p-2 ring-1 ring-border/40 hover:ring-primary/50"
      >
        <span className="rounded-full bg-black/60 p-2" aria-hidden>
          <Play className="h-4 w-4 fill-white text-white" />
        </span>
        {post.content && <p className="line-clamp-2 text-center text-[11px] text-muted-foreground" dir="auto">{post.content}</p>}
      </Link>
    );
  }
  if (post.kind === "text" || !post.thumbnail) {
    return (
      <Link
        to={`/posts/${post.id}`}
        aria-label={label}
        className="flex aspect-square flex-col justify-between overflow-hidden rounded-xl border border-border/50 bg-card p-2 text-start hover:border-primary/50"
      >
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="line-clamp-4 text-xs leading-snug" dir="auto">{post.content}</p>
      </Link>
    );
  }
  return (
    <Link
      to={`/posts/${post.id}`}
      aria-label={label}
      className="group relative aspect-square overflow-hidden rounded-xl bg-asphalt ring-1 ring-border/40"
    >
      <img src={mediaUrl(post.thumbnail)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      {post.kind === "video" && (
        <span className="absolute end-1.5 top-1.5 rounded-full bg-black/60 p-1" aria-hidden>
          <Play className="h-3 w-3 fill-white text-white" />
        </span>
      )}
    </Link>
  );
}
