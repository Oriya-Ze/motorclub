import { useQuery } from "@tanstack/react-query";
import { Hash, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

export default function ExplorePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const tag = params.get("tag") || "";
  const [search, setSearch] = useState("");

  const { data: explorePosts = [] } = useQuery({
    queryKey: ["explore-posts"],
    queryFn: () => api.explorePosts(),
  });

  const { data: hashtags = [] } = useQuery({
    queryKey: ["trending-hashtags"],
    queryFn: () => api.trendingHashtags(),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["explore-vehicles"],
    queryFn: () => api.exploreVehicles(),
  });

  const { data: tagPosts = [] } = useQuery({
    queryKey: ["posts", "tag", tag],
    queryFn: () => api.getPosts(tag),
    enabled: !!tag,
  });

  const { data: users = [] } = useQuery({
    queryKey: ["search", search],
    queryFn: () => api.searchUsers(search),
    enabled: search.length >= 2,
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">{t("explore")}</h1>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchUsers")}
            className="w-full h-11 bg-muted/30 border border-border rounded-xl pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        {search.length >= 2 && users.length > 0 && (
          <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
            {users.map((u) => (
              <Link key={u.id} to={`/profile/${u.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm">
                  {u.full_name[0]}
                </div>
                <div>
                  <p className="font-medium text-sm">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {tag ? (
        <div>
          <h2 className="font-semibold mb-3">#{tag}</h2>
          <div className="grid grid-cols-3 gap-1">
            {tagPosts.filter((p) => p.image_urls?.[0]).map((p) => (
              <div key={p.id} className="aspect-square bg-muted rounded-lg overflow-hidden">
                <img src={mediaUrl(p.image_urls![0])} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {hashtags.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                {t("trendingHashtags")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {hashtags.map((h) => (
                  <Link
                    key={h.tag}
                    to={`/explore?tag=${h.tag}`}
                    className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm hover:bg-primary/20 transition-colors"
                  >
                    #{h.tag} <span className="text-xs opacity-70">({h.count})</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="font-semibold mb-3">{t("explorePhotos")}</h2>
            <div className="grid grid-cols-3 gap-1">
              {explorePosts.filter((p) => p.thumbnail).map((p) => (
                <div key={p.id} className="aspect-square bg-muted rounded-lg overflow-hidden relative group">
                  <img src={mediaUrl(p.thumbnail!)} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          </div>

          {vehicles.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3">{t("garage.title")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {vehicles.map((v) => (
                  <Link
                    key={v.id}
                    to={v.owner ? `/profile/${v.owner.id}` : "#"}
                    className="flex gap-3 bg-card border border-border/40 rounded-xl p-3 hover:shadow-glow transition-shadow"
                  >
                    {v.thumbnail ? (
                      <img src={mediaUrl(v.thumbnail)} alt="" className="w-20 h-20 object-cover rounded-lg shrink-0" />
                    ) : (
                      <div className="w-20 h-20 gradient-primary rounded-lg shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">{v.year} {v.make} {v.model}</p>
                      {v.owner && <p className="text-xs text-muted-foreground">@{v.owner.username}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
