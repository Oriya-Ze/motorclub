import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Calendar, Car, Compass, LogOut, Mail, MessageSquare, Menu, Plus, Settings,
  ShoppingBag, UserCircle, Users, Warehouse, Wrench, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import CreatePostModal from "@/components/CreatePostModal";
import UserSearch from "@/components/UserSearch";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { prefetchAppData, prefetchRoute } from "@/lib/prefetch";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "feed", icon: Car },
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
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

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

  const toggleLang = () => {
    const next = i18n.language === "he" ? "en" : "he";
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "he" ? "rtl" : "ltr";
  };

  return (
    <div className="min-h-screen gradient-bg">
      <header className="sticky top-0 z-50 glass-card border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg hidden sm:block">{t("appName")}</span>
          </Link>

          {user && (
            <div className="hidden sm:block flex-1 max-w-md">
              <UserSearch />
            </div>
          )}

          <nav className="hidden xl:flex items-center gap-1">
            {user && navItems.slice(0, 6).map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onMouseEnter={() => prefetchRoute(queryClient, to)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-colors",
                    isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {t(label)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <button onClick={toggleLang} className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-muted transition-colors">
              {i18n.language === "he" ? "EN" : "עב"}
            </button>
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
                  {t("create")}
                </Button>
                <Link to="/profile" className="hidden md:flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-muted/50">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold">
                    {user.full_name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-medium hidden lg:inline">{user.username}</span>
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

      <main className={cn("max-w-6xl mx-auto px-4 py-4 md:py-6", user && "pb-24 md:pb-6")}>
        <Outlet />
      </main>

      {user && (
        <>
          <BottomNav onCreatePost={() => setShowCreate(true)} unreadCount={unread?.count} />
          <CreatePostModal open={showCreate} onClose={() => setShowCreate(false)} />
        </>
      )}
    </div>
  );
}
