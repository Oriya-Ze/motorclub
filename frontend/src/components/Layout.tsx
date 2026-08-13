import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Calendar, Compass, Home, LogOut, Mail, MessageSquare, Menu, Plus, Settings,
  ShoppingBag, UserCircle, Users, Warehouse, Wrench, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import LanguageToggle from "@/components/LanguageToggle";
import CreatePostModal from "@/components/CreatePostModal";
import ThemeSync from "@/components/ThemeSync";
import UserSearch from "@/components/UserSearch";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { prefetchAppData, prefetchRoute } from "@/lib/prefetch";
import { cn, displayUsername } from "@/lib/utils";

const navItems = [
  { to: "/", label: "feed", icon: Home },
  { to: "/explore", label: "explore", icon: Compass },
  { to: "/garage", label: "garage.nav", icon: Warehouse },
  { to: "/groups", label: "groups", icon: Users },
  { to: "/events", label: "events", icon: Calendar },
  { to: "/marketplace", label: "marketplace", icon: ShoppingBag },
  { to: "/forums", label: "forums", icon: MessageSquare },
  { to: "/messages", label: "messages", icon: Mail },
  { to: "/services", label: "services", icon: Wrench },
];

export default function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createVehicleId, setCreateVehicleId] = useState<string | undefined>();

  useEffect(() => {
    const state = location.state as { openCreatePost?: boolean; vehicleId?: string } | null;
    if (!state?.openCreatePost) return;
    setShowCreate(true);
    setCreateVehicleId(state.vehicleId);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (user) prefetchAppData(queryClient);
  }, [user, queryClient]);

  const { data: unread } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => api.getUnreadCount(),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen gradient-bg">
      <header className="sticky top-0 z-50 glass-card border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <img src="/logo.png" alt={t("appName")} className="w-9 h-9 rounded-xl object-cover" />
              <span className="font-bold text-lg hidden sm:block font-display tracking-wide">{t("appName")}</span>
            </Link>

            {user && (
              <div className="hidden md:block flex-1 min-w-0 max-w-sm lg:max-w-md mx-2">
                <UserSearch />
              </div>
            )}

            <div className="flex items-center gap-1 shrink-0">
              <LanguageToggle />
              {user && (
                <Link to="/notifications" className="relative p-2 rounded-xl hover:bg-muted/50">
                  <Bell className="w-5 h-5" />
                  {(unread?.count ?? 0) > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center">
                      {unread!.count > 9 ? "9+" : unread!.count}
                    </span>
                  )}
                </Link>
              )}
              {user && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden md:flex gap-1.5"
                    onClick={() => setShowCreate(true)}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden lg:inline">{t("create")}</span>
                  </Button>
                  <Link to="/profile" className="hidden md:flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-muted/50">
                    <Avatar user={user} size="sm" />
                    <span className="text-sm font-medium hidden xl:inline">{displayUsername(user)}</span>
                  </Link>
                  <Link to="/settings"><Button variant="ghost" size="icon"><Settings className="w-5 h-5" /></Button></Link>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="hidden md:flex"><LogOut className="w-5 h-5" /></Button>
                </>
              )}
              {!user && (
                <Link to="/auth"><Button size="sm">{t("login")}</Button></Link>
              )}
              <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => user && setMobileOpen(!mobileOpen)} disabled={!user}>
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {user && (
            <nav className="hidden xl:flex flex-wrap items-center gap-1 pb-3 pt-0.5 border-t border-border/40">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onMouseEnter={() => prefetchRoute(queryClient, to)}
                  className={({ isActive }) =>
                    cn(
                      "nav-link",
                      isActive ? "nav-link-active text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {t(label)}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        {mobileOpen && user && (
          <nav className="xl:hidden border-t border-border/50 px-4 py-3 flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
            <div className="pb-3 sm:hidden"><UserSearch /></div>
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === "/"} onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium", isActive ? "text-primary bg-primary/10" : "text-muted-foreground")}>
                <Icon className="w-4 h-4" />{t(label)}
              </NavLink>
            ))}
            <NavLink to="/profile" onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium", isActive ? "text-primary bg-primary/10" : "text-muted-foreground")}>
              <UserCircle className="w-4 h-4" />{t("profile.nav")}
            </NavLink>
          </nav>
        )}
      </header>

      <main className={cn("feed-scroll max-w-7xl mx-auto px-4 py-4 md:py-6 page-enter", user && "pb-24 md:pb-6")}>
        <Outlet />
      </main>

      {user && (
        <>
          <ThemeSync />
          <BottomNav onCreatePost={() => setShowCreate(true)} unreadCount={unread?.count} />
          <CreatePostModal
            open={showCreate}
            onClose={() => {
              setShowCreate(false);
              setCreateVehicleId(undefined);
            }}
            initialVehicleId={createVehicleId}
          />
        </>
      )}
    </div>
  );
}
