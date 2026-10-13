import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import HomePage from "@/pages/HomePage";
import { pageLoaders, preloadAllPagesWhenIdle } from "@/lib/pageLoaders";

const AuthPage = lazy(pageLoaders.auth);
const OAuthCallbackPage = lazy(pageLoaders.oauthCallback);
const ForgotPasswordPage = lazy(pageLoaders.forgotPassword);
const ResetPasswordPage = lazy(pageLoaders.resetPassword);
const LegalPage = lazy(() => pageLoaders.legal().then((m) => ({ default: m.LegalPage })));
const VehiclePage = lazy(pageLoaders.vehicle);
const StoryViewerPage = lazy(pageLoaders.storyViewer);
const CreateStoryPage = lazy(pageLoaders.createStory);
const ExplorePage = lazy(pageLoaders.explore);
const PostPage = lazy(pageLoaders.post);
const BusinessProfilePage = lazy(pageLoaders.businessProfile);
const GaragePage = lazy(pageLoaders.garage);
const NotificationsPage = lazy(pageLoaders.notifications);
const CommunityPage = lazy(pageLoaders.community);
const GroupsPage = lazy(pageLoaders.groups);
const GroupDetailPage = lazy(pageLoaders.groupDetail);
const ForumsPage = lazy(pageLoaders.forums);
const ForumTopicsPage = lazy(pageLoaders.forumTopics);
const ForumTopicPage = lazy(pageLoaders.forumTopic);
const MessagesRedirect = lazy(pageLoaders.messages);
const EventsPage = lazy(pageLoaders.events);
const MarketplacePage = lazy(pageLoaders.marketplace);
const ServicesPage = lazy(pageLoaders.services);
const ProfilePage = lazy(pageLoaders.profile);
const SettingsPage = lazy(pageLoaders.settings);

// The admin console is a separate page with its own layout, loaded only when staff open it.
const AdminConsole = lazy(() => import("@/pages/admin/AdminConsole"));

function WorkshopRedirect() {
  const { userId } = useParams();
  return <Navigate to={userId ? `/services/${userId}` : "/services"} replace />;
}

export default function App() {
  useEffect(() => {
    preloadAllPagesWhenIdle();
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen gradient-bg" role="status" aria-label="טוען" />}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/privacy-policy" element={<LegalPage type="privacy" />} />
          <Route path="/terms-of-service" element={<LegalPage type="terms" />} />
          <Route path="/vehicles/:vehicleId" element={<VehiclePage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route
            path="admin/*"
            element={
              <Suspense fallback={<div className="min-h-screen gradient-bg" role="status" aria-label="טוען" />}>
                <AdminConsole />
              </Suspense>
            }
          />
          <Route path="stories/:storyId" element={<StoryViewerPage />} />
          <Route element={<Layout />}>
            <Route path="explore" element={<ExplorePage />} />
            <Route path="posts/:postId" element={<PostPage />} />
            <Route path="workshops" element={<Navigate to="/services" replace />} />
            <Route path="workshops/:userId" element={<WorkshopRedirect />} />
            <Route path="services/:userId" element={<BusinessProfilePage />} />
            <Route path="garage" element={<GaragePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="stories/create" element={<CreateStoryPage />} />
            <Route path="community" element={<CommunityPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="groups/:groupId" element={<GroupDetailPage />} />
            <Route path="forums" element={<ForumsPage />} />
            <Route path="forums/:forumId" element={<ForumTopicsPage />} />
            <Route path="forums/topic/:topicId" element={<ForumTopicPage />} />
            <Route path="messages" element={<MessagesRedirect />} />
            <Route path="messages/:conversationId" element={<MessagesRedirect />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="marketplace" element={<MarketplacePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/:userId" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
