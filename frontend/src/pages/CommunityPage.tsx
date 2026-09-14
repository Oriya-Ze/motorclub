import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { forumDescription, forumName } from "@/lib/forum";
import { cn } from "@/lib/utils";

type Tab = "groups" | "forums";

export default function CommunityPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(tabParam === "forums" ? "forums" : "groups");

  const switchTab = (next: Tab) => {
    setTab(next);
    setSearchParams(next === "groups" ? {} : { tab: next }, { replace: true });
  };

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
    enabled: tab === "groups",
  });

  const { data: forums = [], isLoading: forumsLoading } = useQuery({
    queryKey: ["forums"],
    queryFn: () => api.getForums(),
    enabled: tab === "forums",
  });

  const loading = tab === "groups" ? groupsLoading : forumsLoading;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeading subtitle={t("communitySubtitle")}>{t("community")}</PageHeading>

      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border/50">
        {(["groups", "forums"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => switchTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors",
              tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {id === "groups" ? <Users className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            {t(id)}
          </button>
        ))}
      </div>

      {loading ? (
        <ListPageSkeleton rows={4} />
      ) : tab === "groups" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={() => navigate("/groups", { state: { openCreate: true } })}>
              <Plus className="w-4 h-4" />
              {t("createGroup")}
            </Button>
          </div>
          {groups.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <Users className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">{t("noGroups")}</p>
              <Button onClick={() => navigate("/groups")}>{t("createGroup")}</Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((group) => (
                <Link key={group.id} to={`/groups/${group.id}`}>
                  <Card className="hover:shadow-glow transition-shadow h-full">
                    <CardContent className="pt-5 pb-5 flex gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{group.name}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {group.privacy === "closed" && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {t("groupPrivacyClosed")}
                            </span>
                          )}
                          {group.my_status === "pending" && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600">
                              {t("groupJoinPending")}
                            </span>
                          )}
                        </div>
                        {group.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{group.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {group.members_count} {t("members")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {groups.length > 0 && (
            <div className="text-center pt-2">
              <Link to="/groups" className="text-sm text-primary hover:underline">
                {t("viewAllGroups")}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {forums.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">{t("noForums")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {forums.map((forum) => (
                <Link key={forum.id} to={`/forums/${forum.id}`}>
                  <Card className="hover:shadow-glow transition-shadow h-full">
                    <CardContent className="pt-5 pb-5 flex gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">{forumName(forum, i18n.language)}</h3>
                        {forumDescription(forum, i18n.language) && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                            {forumDescription(forum, i18n.language)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {forum.topics_count} {t("topics")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
          {forums.length > 0 && (
            <div className="text-center pt-2">
              <Link to="/forums" className="text-sm text-primary hover:underline">
                {t("viewAllForums")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
