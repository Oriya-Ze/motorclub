import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthPage from "@/pages/AuthPage";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import CreateStoryPage from "@/pages/CreateStoryPage";
import StoryViewerPage from "@/pages/StoryViewerPage";
import EventsPage from "@/pages/EventsPage";
import ExplorePage from "@/pages/ExplorePage";
import FeedPage from "@/pages/FeedPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import ForumTopicPage from "@/pages/ForumTopicPage";
import ForumTopicsPage from "@/pages/ForumTopicsPage";
import ForumsPage from "@/pages/ForumsPage";
import GaragePage from "@/pages/GaragePage";
import GroupDetailPage from "@/pages/GroupDetailPage";
import GroupsPage from "@/pages/GroupsPage";
import { LegalPage } from "@/pages/LegalPage";
import MarketplacePage from "@/pages/MarketplacePage";
import MessagesRedirect from "@/pages/MessagesRedirect";
import NotificationsPage from "@/pages/NotificationsPage";
import PostPage from "@/pages/PostPage";
import ProfilePage from "@/pages/ProfilePage";
import ServicesPage from "@/pages/ServicesPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        <Route element={<Layout />}>
          <Route path="/privacy-policy" element={<LegalPage type="privacy" />} />
          <Route path="/terms-of-service" element={<LegalPage type="terms" />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="stories/:storyId" element={<StoryViewerPage />} />
          <Route element={<Layout />}>
            <Route index element={<FeedPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="posts/:postId" element={<PostPage />} />
            <Route path="garage" element={<GaragePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="stories/create" element={<CreateStoryPage />} />
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
    </BrowserRouter>
  );
}
