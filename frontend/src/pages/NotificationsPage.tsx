import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Heart, MessageCircle, UserPlus, Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api, Notification } from "@/lib/api";
import { cn, displayName } from "@/lib/utils";

const iconMap: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  follow_request: UserPlus,
  follow_accepted: UserPlus,
  follow_rejected: UserPlus,
  group_join_request: Users,
  group_join_accepted: Users,
  group_join_rejected: Users,
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
    refetchInterval: 30000,
  });

  const { data: followRequests = [] } = useQuery({
    queryKey: ["follow-requests"],
    queryFn: () => api.getFollowRequests(),
    refetchInterval: 30000,
  });

  const pendingFollowerIds = new Set(followRequests.map((r) => r.user_id));
  const feed = notifications.filter(
    (n) => !(n.type === "follow_request" && n.actor_id && pendingFollowerIds.has(n.actor_id)),
  );

  const markAllRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const approveFollow = useMutation({
    mutationFn: (followerId: string) => api.approveFollowRequest(followerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["followers-count"] });
      queryClient.invalidateQueries({ queryKey: ["follow-status"] });
      toast.success(t("profile.followApproved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectFollow = useMutation({
    mutationFn: (followerId: string) => api.rejectFollowRequest(followerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-requests"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(t("profile.followDeclined"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const titleFor = (n: Notification) => {
    const name = n.body || "";
    if (n.type === "follow") return t("notifications.followNew", { name });
    if (n.type === "follow_request") return t("notifications.followRequest", { name });
    if (n.type === "follow_accepted") return t("notifications.followAccepted", { name });
    if (n.type === "follow_rejected") return t("notifications.followRejected", { name });
    return n.title;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 md:pb-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeading className="mb-0">{t("notifications.title")}</PageHeading>
        {notifications.some((n) => !n.is_read) && (
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {followRequests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">{t("notifications.followRequests")}</h2>
          {followRequests.map((req) => (
            <div
              key={req.user_id}
              className="flex items-center gap-3 p-4 rounded-xl border bg-primary/5 border-primary/20"
            >
              <Link to={`/users/${req.user_id}`} className="flex-1 min-w-0">
                <p className="font-medium text-sm">{displayName(req.user)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("notifications.followRequest", { name: displayName(req.user) })}
                </p>
              </Link>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  disabled={approveFollow.isPending || rejectFollow.isPending}
                  onClick={() => approveFollow.mutate(req.user_id)}
                >
                  <Check className="w-4 h-4 me-1" />
                  {t("notifications.approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={approveFollow.isPending || rejectFollow.isPending}
                  onClick={() => rejectFollow.mutate(req.user_id)}
                >
                  <X className="w-4 h-4 me-1" />
                  {t("notifications.decline")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <ListPageSkeleton rows={5} />
      ) : feed.length === 0 && followRequests.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
          <p className="text-muted-foreground">{t("notifications.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {feed.map((n: Notification) => {
            const Icon = iconMap[n.type] || Bell;
            const inner = (
              <>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{titleFor(n)}</p>
                  {n.type !== "follow" && n.type !== "follow_request" && n.type !== "follow_accepted" && n.type !== "follow_rejected" && n.body && (
                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{n.body}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("he-IL")}
                  </p>
                </div>
              </>
            );
            const className = cn(
              "flex items-start gap-3 p-4 rounded-xl border transition-colors",
              n.is_read ? "bg-card/50 border-border/30" : "bg-primary/5 border-primary/20",
            );
            return n.link ? (
              <Link key={n.id} to={n.link} className={className}>
                {inner}
              </Link>
            ) : (
              <div key={n.id} className={className}>
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
