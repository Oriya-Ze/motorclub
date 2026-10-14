import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { safeInternalNext } from "@/lib/authNext";
import LogoLoader from "@/components/LogoLoader";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LogoLoader fullScreen />;
  }

  if (!user) {
    const next = safeInternalNext(`${location.pathname}${location.search}`);
    const target = next ? `/auth?next=${encodeURIComponent(next)}` : "/auth";
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
