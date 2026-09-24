import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { safeInternalNext } from "@/lib/authNext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const next = safeInternalNext(`${location.pathname}${location.search}`);
    const target = next ? `/auth?next=${encodeURIComponent(next)}` : "/auth";
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
