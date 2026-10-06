/**
 * The admin console. A separate page from the member app: its own layout and navigation, loaded
 * as its own chunk, and only for staff. Hebrew only, since it is an internal tool.
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, Building2, Film, Flag, Gavel, LayoutDashboard, ScrollText, Users } from "lucide-react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn, formatHandle } from "@/lib/utils";
import AdminAccounts from "@/pages/admin/AdminAccounts";
import AdminAppeals from "@/pages/admin/AdminAppeals";
import AdminBusiness from "@/pages/admin/AdminBusiness";
import AdminLog from "@/pages/admin/AdminLog";
import AdminMedia from "@/pages/admin/AdminMedia";
import AdminOverviewPage from "@/pages/admin/AdminOverview";
import AdminReports from "@/pages/admin/AdminReports";

const NAV = [
  { to: "/admin", label: "סקירה", icon: LayoutDashboard, end: true, count: null },
  { to: "/admin/business", label: "בקשות עסק", icon: Building2, count: "pending_business_requests" },
  { to: "/admin/reports", label: "דיווחים", icon: Flag, count: "open_reports" },
  { to: "/admin/media", label: "מדיה לבדיקה", icon: Film, count: "media" },
  { to: "/admin/appeals", label: "ערעורים", icon: Gavel, count: "open_appeals" },
  { to: "/admin/accounts", label: "חשבונות", icon: Users, count: null },
  { to: "/admin/log", label: "יומן פעולות", icon: ScrollText, count: null },
] as const;

export default function AdminConsole() {
  const { user } = useAuth();
  const me = useQuery({ queryKey: ["admin-me"], queryFn: () => api.adminMe(), retry: false });
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api.getModerationOverview(),
    enabled: me.isSuccess,
    refetchInterval: 60_000,
  });

  if (me.isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center" role="status" aria-label="טוען">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (me.isError) return <Navigate to="/" replace />;

  const counts = overview.data;
  const badge = (key: string | null): number => {
    if (!counts || !key) return 0;
    if (key === "media") return counts.videos_to_review + counts.images_to_review + counts.stuck_media;
    return (counts as unknown as Record<string, number>)[key] ?? 0;
  };

  return (
    <div className="min-h-screen gradient-bg text-foreground" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo-192.png" alt="" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-lg tracking-wide">MotorClub</span>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">ניהול</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-muted-foreground">
              {user ? formatHandle(user) : ""} · {me.data?.is_admin ? "מנהל מערכת" : "מודרטור"}
            </span>
            <a href="/" className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 hover:bg-muted">
              <ArrowRight className="h-4 w-4" aria-hidden />
              לאפליקציה
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row">
        <nav aria-label="ניווט ניהול" className="lg:w-56 lg:shrink-0">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {NAV.map((item) => {
              const count = badge(item.count);
              return (
                <li key={item.to} className="shrink-0">
                  <NavLink
                    to={item.to}
                    end={"end" in item ? item.end : false}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors",
                        isActive ? "bg-primary text-primary-foreground" : "bg-card/60 hover:bg-muted",
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" aria-hidden />
                    <span>{item.label}</span>
                    {count > 0 && (
                      <span className="ms-auto rounded-full bg-background/80 px-2 text-xs font-semibold text-foreground" aria-label={`${count} פריטים`}>
                        {count}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
          {me.data?.is_admin && (
            <p className="mt-3 hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              פעולות על חשבונות ותפקידים פתוחות למנהלי מערכת בלבד
            </p>
          )}
        </nav>

        <main className="min-w-0 flex-1">
          <Routes>
            <Route index element={<AdminOverviewPage overview={counts} />} />
            <Route path="business" element={<AdminBusiness />} />
            <Route path="business-requests" element={<Navigate to="/admin/business" replace />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="media" element={<AdminMedia />} />
            <Route path="appeals" element={<AdminAppeals />} />
            <Route path="accounts" element={<AdminAccounts isAdmin={Boolean(me.data?.is_admin)} />} />
            <Route path="log" element={<AdminLog />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
