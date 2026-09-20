import { useAuth } from "@/contexts/AuthContext";
import FeedPage from "@/pages/FeedPage";
import LandingPage from "@/pages/LandingPage";

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return user ? <FeedPage /> : <LandingPage />;
}
