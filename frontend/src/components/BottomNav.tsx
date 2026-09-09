import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Compass, Home, Mail, Plus, User, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { useMessagesPanel } from "@/components/MessagesPanel";
import { api } from "@/lib/api";
import { prefetchRoute } from "@/lib/prefetch";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onCreatePost: () => void;
}

export default function BottomNav({ onCreatePost }: BottomNavProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { openMessages } = useMessagesPanel();

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
    refetchInterval: 30000,
  });

  const messagesUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  const items = [
    { to: "/", icon: Home, label: t("feed"), end: true },
    { to: "/explore", icon: Compass, label: t("explore") },
    { action: onCreatePost, icon: Plus, label: t("create"), primary: true },
    { to: "/community", icon: Users, label: t("community"), matchPrefix: "/community" },
    { action: () => openMessages(), icon: Mail, label: t("messages"), badge: messagesUnread },
    { to: "/profile", icon: User, label: t("profile.nav") },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-card border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around h-16 px-1">
        {items.map((item, i) => {
          if ("action" in item && item.action) {
            if ("primary" in item && item.primary) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={item.action}
                  className="w-12 h-12 -mt-5 gradient-primary rounded-2xl flex items-center justify-center shadow-glow"
                >
                  <Plus className="w-6 h-6 text-white" />
                </button>
              );
            }
            const { action, icon: Icon, label, badge } = item as {
              action: () => void; icon: typeof Home; label: string; badge?: number;
            };
            return (
              <button
                key={i}
                type="button"
                onClick={action}
                className="flex flex-col items-center gap-0.5 px-3 py-1 relative text-muted-foreground"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium truncate max-w-[3.25rem]">{label}</span>
                {badge ? (
                  <span className="absolute top-0 right-1 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </button>
            );
          }
          const { to, icon: Icon, label, end, badge, matchPrefix } = item as {
            to: string; icon: typeof Home; label: string; end?: boolean; badge?: number; matchPrefix?: string;
          };
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onMouseEnter={() => prefetchRoute(queryClient, to)}
              onTouchStart={() => prefetchRoute(queryClient, to)}
              className={({ isActive }) => {
                const active =
                  isActive ||
                  (matchPrefix != null &&
                    (location.pathname === matchPrefix ||
                      location.pathname.startsWith(`${matchPrefix}/`) ||
                      (matchPrefix === "/community" &&
                        (location.pathname.startsWith("/groups") || location.pathname.startsWith("/forums")))));
                return cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 relative min-w-0",
                  active ? "text-primary" : "text-muted-foreground",
                );
              }}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium truncate max-w-[3.25rem]">{label}</span>
              {badge ? (
                <span className="absolute top-0 right-1 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
