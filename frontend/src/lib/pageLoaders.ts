/**
 * Every page except the home feed loads as its own chunk, so the first screen parses far less script.
 * The same loaders warm a page before it is opened: on touch or hover of a nav link, and once the app is idle.
 */
export const pageLoaders = {
  auth: () => import("@/pages/AuthPage"),
  oauthCallback: () => import("@/pages/OAuthCallbackPage"),
  forgotPassword: () => import("@/pages/ForgotPasswordPage"),
  resetPassword: () => import("@/pages/ResetPasswordPage"),
  legal: () => import("@/pages/LegalPage"),
  vehicle: () => import("@/pages/VehiclePage"),
  storyViewer: () => import("@/pages/StoryViewerPage"),
  createStory: () => import("@/pages/CreateStoryPage"),
  explore: () => import("@/pages/ExplorePage"),
  post: () => import("@/pages/PostPage"),
  businessProfile: () => import("@/pages/BusinessProfilePage"),
  garage: () => import("@/pages/GaragePage"),
  notifications: () => import("@/pages/NotificationsPage"),
  community: () => import("@/pages/CommunityPage"),
  groups: () => import("@/pages/GroupsPage"),
  groupDetail: () => import("@/pages/GroupDetailPage"),
  forums: () => import("@/pages/ForumsPage"),
  forumTopics: () => import("@/pages/ForumTopicsPage"),
  forumTopic: () => import("@/pages/ForumTopicPage"),
  messages: () => import("@/pages/MessagesRedirect"),
  events: () => import("@/pages/EventsPage"),
  marketplace: () => import("@/pages/MarketplacePage"),
  services: () => import("@/pages/ServicesPage"),
  profile: () => import("@/pages/ProfilePage"),
  settings: () => import("@/pages/SettingsPage"),
  createPost: () => import("@/components/CreatePostModal"),
};

const loadersByPath: Record<string, () => Promise<unknown>> = {
  "/explore": pageLoaders.explore,
  "/garage": pageLoaders.garage,
  "/notifications": pageLoaders.notifications,
  "/community": pageLoaders.community,
  "/groups": pageLoaders.groups,
  "/forums": pageLoaders.forums,
  "/events": pageLoaders.events,
  "/marketplace": pageLoaders.marketplace,
  "/services": pageLoaders.services,
  "/profile": pageLoaders.profile,
  "/settings": pageLoaders.settings,
};

export function preloadPage(path: string) {
  void loadersByPath[path]?.().catch(() => {});
}

/** Fetch the remaining pages one at a time while the device is idle, after the first screen is up. */
export function preloadAllPagesWhenIdle() {
  const idle = (cb: () => void) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(cb, { timeout: 4000 });
    else setTimeout(cb, 300);
  };
  const queue = Object.values(pageLoaders);
  const next = () => {
    const load = queue.shift();
    if (load) idle(() => void load().catch(() => {}).finally(next));
  };
  setTimeout(next, 3000);
}
