import { useQueryClient } from "@tanstack/react-query";
import { Bell, Compass, Home, Plus, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router-dom";
import { prefetchRoute } from "@/lib/prefetch";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  onCreatePost: () => void;
  unreadCount?: number;
}

export default function BottomNav({ onCreatePost, unreadCount = 0 }: BottomNavProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const items = [
    { to: "/", icon: Home, label: t("feed"), end: true },
    { to: "/explore", icon: Compass, label: t("explore") },
    { action: onCreatePost, icon: Plus, label: t("create"), primary: true },
    { to: "/notifications", icon: Bell, label: t("notifications.title"), badge: unreadCount },
    { to: "/profile", icon: User, label: t("profile.nav") },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-card border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map((item, i) => {
          if ("action" in item && item.action) {
            return (
              <button
                key={i}
                onClick={item.action}
                className="w-12 h-12 -mt-5 gradient-primary rounded-2xl flex items-center justify-center shadow-glow"
              >
                <Plus className="w-6 h-6 text-white" />
              </button>
            );
          }
          const { to, icon: Icon, label, end, badge } = item as {
            to: string; icon: typeof Home; label: string; end?: boolean; badge?: number;
          };
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onMouseEnter={() => prefetchRoute(queryClient, to)}
              onTouchStart={() => prefetchRoute(queryClient, to)}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 relative",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
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
