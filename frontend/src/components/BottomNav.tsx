import { useQueryClient } from "@tanstack/react-query";
import { Car, Compass, Home, User, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { prefetchRoute } from "@/lib/prefetch";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  icon: typeof Home;
  labelKey: string;
  end?: boolean;
  matchPrefixes?: string[];
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", icon: Home, labelKey: "feed", end: true },
  { to: "/explore", icon: Compass, labelKey: "explore" },
  { to: "/garage", icon: Car, labelKey: "garage.tools", matchPrefixes: ["/garage", "/vehicles"] },
  { to: "/community", icon: Users, labelKey: "community", matchPrefixes: ["/community"] },
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
      <div className="mx-auto flex h-16 max-w-lg items-stretch px-1">
        {NAV_ITEMS.map(({ to, icon: Icon, labelKey, end, matchPrefixes }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onTouchStart={() => prefetchRoute(queryClient, to)}
            className={({ isActive }) => {
              const active =
                isActive ||
                (matchPrefixes?.some(
                  (prefix) =>
                    location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
                ) ??
                  false) ||
                (to === "/community" &&
                  (location.pathname.startsWith("/groups") ||
                    location.pathname.startsWith("/forums")));
              return cn(
                "flex flex-1 flex-col items-center justify-center gap-1 min-h-[44px] min-w-0 rounded-xl transition-colors px-0.5",
                active ? "text-primary" : "text-muted-foreground",
              );
            }}
          >
            <Icon className="w-5 h-5 shrink-0" aria-hidden />
            <span className="text-[11px] font-medium leading-none truncate max-w-full">{t(labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
