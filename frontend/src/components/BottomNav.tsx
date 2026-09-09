import { useQueryClient } from "@tanstack/react-query";
import { Compass, Home, User, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { prefetchRoute } from "@/lib/prefetch";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  icon: typeof Home;
  labelKey: "feed" | "explore" | "community" | "profile.nav";
  end?: boolean;
  matchPrefix?: string;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", icon: Home, labelKey: "feed", end: true },
  { to: "/explore", icon: Compass, labelKey: "explore" },
  { to: "/community", icon: Users, labelKey: "community", matchPrefix: "/community" },
  { to: "/profile", icon: User, labelKey: "profile.nav" },
];

export default function BottomNav() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/50 bg-background/92 backdrop-blur-xl pb-safe"
      aria-label={t("mainNav")}
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        {NAV_ITEMS.map(({ to, icon: Icon, labelKey, end, matchPrefix }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onTouchStart={() => prefetchRoute(queryClient, to)}
            className={({ isActive }) => {
              const active =
                isActive ||
                (matchPrefix != null &&
                  (location.pathname === matchPrefix ||
                    location.pathname.startsWith(`${matchPrefix}/`) ||
                    (matchPrefix === "/community" &&
                      (location.pathname.startsWith("/groups") ||
                        location.pathname.startsWith("/forums")))));
              return cn(
                "flex flex-1 flex-col items-center justify-center gap-1 min-h-[44px] min-w-[44px] rounded-xl transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              );
            }}
          >
            <Icon className="w-5 h-5 shrink-0" aria-hidden />
            <span className="text-[11px] font-medium leading-none">{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
