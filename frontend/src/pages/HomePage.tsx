import { useAuth } from "@/contexts/AuthContext";
import FeedPage from "@/pages/FeedPage";
import LandingPage from "@/pages/LandingPage";
import LogoLoader from "@/components/LogoLoader";

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LogoLoader />
      </div>
    );
  }

  return user ? <FeedPage /> : <LandingPage />;
}
