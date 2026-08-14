import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Heart, MessageCircle, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api, Notification } from "@/lib/api";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
    refetchInterval: 30000,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

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

      {isLoading ? (
        <ListPageSkeleton rows={5} />
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
          <p className="text-muted-foreground">{t("notifications.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: Notification) => {
            const Icon = iconMap[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border transition-colors",
                  n.is_read ? "bg-card/50 border-border/30" : "bg-primary/5 border-primary/20"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground mt-0.5 truncate">{n.body}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("he-IL")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
