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

type NavItem = {
  to: string;
  icon: typeof Home;
  label: string;
  end?: boolean;
  badge?: number;
  matchPrefix?: string;
};

function NavItemButton({
  item,
  queryClient,
  location,
}: {
  item: NavItem;
  queryClient: ReturnType<typeof useQueryClient>;
  location: ReturnType<typeof useLocation>;
}) {
  const { to, icon: Icon, label, end, badge, matchPrefix } = item;

  return (
    <NavLink
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
          "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 relative rounded-xl transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        );
      }}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-[10px] font-medium truncate max-w-[4rem] leading-tight">{label}</span>
      {badge ? (
        <span className="absolute top-0 end-1 min-w-[1rem] h-4 px-0.5 bg-primary text-white text-[9px] rounded-full flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </NavLink>
  );
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

  const leftItems: NavItem[] = [
    { to: "/", icon: Home, label: t("feed"), end: true },
    { to: "/explore", icon: Compass, label: t("explore") },
  ];

  const rightItems: NavItem[] = [
    { to: "/community", icon: Users, label: t("community"), matchPrefix: "/community" },
    { to: "/profile", icon: User, label: t("profile.nav") },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-xl pb-safe"
      aria-label={t("mainNav")}
    >
      <div className="relative mx-auto max-w-lg h-[3.75rem]">
        <div className="grid grid-cols-[1fr_4.5rem_1fr] h-full items-end px-1">
          <div className="flex items-end justify-evenly gap-0.5 pb-1.5">
            {leftItems.map((item) => (
              <NavItemButton key={item.to} item={item} queryClient={queryClient} location={location} />
            ))}
          </div>

          <div className="flex items-end justify-center pb-1.5" aria-hidden />

          <div className="flex items-end justify-evenly gap-0.5 pb-1.5">
            {rightItems.map((item) => (
              <NavItemButton key={item.to} item={item} queryClient={queryClient} location={location} />
            ))}
            <button
              type="button"
              onClick={() => openMessages()}
              className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 relative rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t("messages")}
            >
              <Mail className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium truncate max-w-[4rem] leading-tight">{t("messages")}</span>
              {messagesUnread > 0 && (
                <span className="absolute top-0 end-1 min-w-[1rem] h-4 px-0.5 bg-primary text-white text-[9px] rounded-full flex items-center justify-center">
                  {messagesUnread > 9 ? "9+" : messagesUnread}
                </span>
              )}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreatePost}
          aria-label={t("createPost")}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
            "flex h-14 w-14 items-center justify-center rounded-2xl",
            "gradient-primary text-white shadow-glow",
            "ring-4 ring-background",
            "transition-transform active:scale-95 hover:scale-105",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>
    </nav>
  );
}
