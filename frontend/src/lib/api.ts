import type { MediaPurpose } from "@/lib/mediaUpload";
import {
  uploadMedia as uploadMediaImpl,
  uploadMediaFiles as uploadMediaFilesImpl,
} from "@/lib/mediaUpload";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  profile_picture_url?: string | null;
  account_type: string;
  business_type?: string | null;
  is_verified: boolean;
}

export interface AuthResponse {
  user?: User | null;
  access_token?: string | null;
  token_type?: string;
  expires_in?: number;
  confirmation_required?: boolean;
  message?: string | null;
}

export interface OAuthConfig {
  google_enabled: boolean;
  client_id?: string | null;
  cognito_domain?: string | null;
  region?: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  content?: string | null;
  image_urls?: string[] | null;
  video_urls?: string[] | null;
  location?: string | null;
  vehicle_id?: string | null;
  hashtags?: string[] | null;
  created_at: string;
  author: User;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_saved: boolean;
}

export interface UserPost {
  id: string;
  content?: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  image_urls?: string[] | null;
  created_at: string;
  seller?: User | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: User;
}

export interface ConversationSummary {
  id: string;
  other_user: User;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ForumTopic {
  id: string;
  forum_id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_solved: boolean;
  views_count: number;
  replies_count: number;
  created_at: string;
  author: User;
}

export interface ForumReply {
  id: string;
  topic_id: string;
  user_id: string;
  content: string;
  is_best_answer: boolean;
  created_at: string;
  author: User;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  author: User;
}

export interface Vehicle {
  id: string;
  user_id: string;
  make: string;
  model: string;
  year?: number | null;
  trim?: string | null;
  color?: string | null;
  engine?: string | null;
  description?: string | null;
  mods?: string | null;
  image_urls?: string[] | null;
  is_primary: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption?: string | null;
  expires_at: string;
  created_at: string;
  author: User;
}

class ApiClient {
  private token: string | null = localStorage.getItem("access_token");

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem("access_token", token);
    else localStorage.removeItem("access_token");
  }

  getToken() {
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const isForm = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string>),
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (response.status === 401) {
      this.setToken(null);
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth";
      }
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || "Request failed");
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  register(data: { email: string; username: string; full_name: string; password: string }) {
    return this.request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(data) });
  }

  confirmSignUp(data: { email: string; code: string; password: string }) {
    return this.request<AuthResponse>("/auth/confirm", { method: "POST", body: JSON.stringify(data) });
  }

  login(data: { email: string; password: string }) {
    return this.request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) });
  }

  getOAuthConfig() {
    return this.request<OAuthConfig>("/auth/oauth/config");
  }

  oauthCallback(data: { code: string; redirect_uri: string }) {
    return this.request<AuthResponse>("/auth/oauth/callback", { method: "POST", body: JSON.stringify(data) });
  }

  me() {
    return this.request<User>("/auth/me");
  }

  forgotPassword(email: string) {
    return this.request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  resetPassword(data: { email: string; code: string; new_password: string }) {
    return this.request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getPosts(opts?: string | { hashtag?: string; userId?: string; vehicleId?: string; skip?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (typeof opts === "string") {
      params.set("hashtag", opts);
    } else if (opts) {
      if (opts.hashtag) params.set("hashtag", opts.hashtag);
      if (opts.userId) params.set("user_id", opts.userId);
      if (opts.vehicleId) params.set("vehicle_id", opts.vehicleId);
      if (opts.skip != null) params.set("skip", String(opts.skip));
      if (opts.limit != null) params.set("limit", String(opts.limit));
    }
    const q = params.toString() ? `?${params}` : "";
    return this.request<Post[]>(`/posts${q}`);
  }

  getPost(postId: string) {
    return this.request<Post>(`/posts/${postId}`);
  }

  getSavedPosts() {
    return this.request<Post[]>("/posts/saved");
  }

  createPost(data: {
    content?: string;
    image_urls?: string[];
    video_urls?: string[];
    location?: string;
    vehicle_id?: string;
    hashtags?: string[];
  }) {
    return this.request<Post>("/posts", { method: "POST", body: JSON.stringify(data) });
  }

  toggleSave(postId: string) {
    return this.request<{ saved: boolean }>(`/posts/${postId}/save`, { method: "POST" });
  }

  uploadMedia(file: File, purpose: MediaPurpose) {
    return uploadMediaImpl(file, purpose, {
      request: this.request.bind(this),
      getToken: () => this.getToken(),
    });
  }

  uploadMediaFiles(files: File[], purpose: MediaPurpose) {
    return uploadMediaFilesImpl(files, purpose, {
      request: this.request.bind(this),
      getToken: () => this.getToken(),
    });
  }

  /** @deprecated Use uploadMedia / uploadMediaFiles instead */
  uploadFiles(files: File[]) {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return this.request<{ files: Array<{ url: string; type: string }> }>("/uploads/multiple", {
      method: "POST",
      body: form,
    });
  }

  /** @deprecated Use uploadMedia instead */
  uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    return this.request<{ url: string; type: string }>("/uploads", { method: "POST", body: form });
  }

  // Garage
  getMyGarage() {
    return this.request<Vehicle[]>("/garage/my");
  }

  getUserGarage(userId: string) {
    return this.request<Vehicle[]>(`/garage/user/${userId}`);
  }

  createVehicle(data: Partial<Vehicle>) {
    return this.request<Vehicle>("/garage", { method: "POST", body: JSON.stringify(data) });
  }

  deleteVehicle(id: string) {
    return this.request<{ deleted: boolean }>(`/garage/${id}`, { method: "DELETE" });
  }

  updateVehicle(id: string, data: Partial<Vehicle>) {
    return this.request<Vehicle>(`/garage/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  // Notifications
  getNotifications() {
    return this.request<Notification[]>("/notifications");
  }

  getUnreadCount() {
    return this.request<{ count: number }>("/notifications/unread-count");
  }

  markAllNotificationsRead() {
    return this.request<{ ok: boolean }>("/notifications/read-all", { method: "POST" });
  }

  // Stories
  getStories() {
    return this.request<Story[]>("/stories");
  }

  createStory(data: { media_url: string; media_type?: string; caption?: string }) {
    return this.request<Story>("/stories", { method: "POST", body: JSON.stringify(data) });
  }

  // Explore
  explorePosts() {
    return this.request<Array<{ id: string; thumbnail?: string; content?: string; author?: User }>>("/explore/posts");
  }

  trendingHashtags() {
    return this.request<Array<{ tag: string; count: number }>>("/explore/hashtags");
  }

  exploreVehicles() {
    return this.request<Array<{ id: string; make: string; model: string; year?: number; thumbnail?: string; owner?: User }>>("/explore/vehicles");
  }

  toggleLike(postId: string) {
    return this.request<{ liked: boolean }>(`/posts/${postId}/like`, { method: "POST" });
  }

  getComments(postId: string) {
    return this.request<Comment[]>(`/posts/${postId}/comments`);
  }

  createComment(postId: string, content: string) {
    return this.request<Comment>(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  searchUsers(q: string) {
    return this.request<User[]>(`/users/search?q=${encodeURIComponent(q)}`);
  }

  getGroups() {
    return this.request<Array<{ id: string; name: string; description?: string; members_count: number; is_member: boolean }>>("/groups");
  }

  createGroup(data: { name: string; description?: string; category?: string }) {
    return this.request<{ id: string; name: string; description?: string; members_count: number; is_member: boolean }>("/groups", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getForums() {
    return this.request<Array<{ id: string; name: string; description?: string; icon?: string; topics_count: number }>>("/forums");
  }

  getForumTopics(forumId: string) {
    return this.request<ForumTopic[]>(`/forums/${forumId}/topics`);
  }

  getTopicReplies(topicId: string) {
    return this.request<ForumReply[]>(`/forums/topics/${topicId}/replies`);
  }

  createTopicReply(topicId: string, content: string) {
    return this.request<ForumReply>(`/forums/topics/${topicId}/replies`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  createTopic(forumId: string, title: string, content: string) {
    return this.request<ForumTopic>("/forums/topics", {
      method: "POST",
      body: JSON.stringify({ forum_id: forumId, title, content }),
    });
  }

  joinGroup(groupId: string) {
    return this.request<{ status: string }>(`/groups/${groupId}/join`, { method: "POST" });
  }

  leaveGroup(groupId: string) {
    return this.request<{ status: string }>(`/groups/${groupId}/leave`, { method: "POST" });
  }

  getGroupMessages(groupId: string) {
    return this.request<GroupMessage[]>(`/groups/${groupId}/messages`);
  }

  sendGroupMessage(groupId: string, content: string) {
    return this.request<GroupMessage>(`/groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  getConversations() {
    return this.request<ConversationSummary[]>("/messages/conversations");
  }

  startConversation(userId: string) {
    return this.request<ConversationSummary>("/messages/conversations", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  }

  getConversationMessages(conversationId: string) {
    return this.request<DirectMessage[]>(`/messages/conversations/${conversationId}/messages`);
  }

  sendDirectMessage(conversationId: string, content: string) {
    return this.request<DirectMessage>(`/messages/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  requestBusinessUpgrade() {
    return this.request<{ status: string }>("/users/me/business-upgrade", { method: "POST" });
  }

  getEvents() {
    return this.request<Array<{
      id: string; title: string; description?: string; event_type: string;
      location?: string; event_date: string; max_participants?: number;
      participants_count: number; is_joined: boolean;
    }>>("/events");
  }

  joinEvent(eventId: string) {
    return this.request<{ joined: boolean }>(`/events/${eventId}/join`, { method: "POST" });
  }

  leaveEvent(eventId: string) {
    return this.request<{ joined: boolean }>(`/events/${eventId}/leave`, { method: "POST" });
  }

  getProducts(category?: string) {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.request<Product[]>(`/marketplace${q}`);
  }

  getServices(businessType?: string) {
    const q = businessType ? `?business_type=${businessType}` : "";
    return this.request<Array<{
      id: string; full_name: string; business_type?: string;
      business_description?: string; business_phone?: string; business_address?: string;
    }>>(`/services${q}`);
  }

  updateProfile(data: { full_name?: string; username?: string; profile_picture_url?: string }) {
    return this.request<User>("/users/me", { method: "PATCH", body: JSON.stringify(data) });
  }

  getSettings() {
    return this.request<{
      profile_public: boolean;
      show_posts: boolean;
      show_groups: boolean;
      theme: string;
      language: string;
      post_notifications: boolean;
      comment_notifications: boolean;
      event_notifications: boolean;
      email_notifications: boolean;
    }>("/users/me/settings");
  }

  updateSettings(data: Record<string, unknown>) {
    return this.request("/users/me/settings", { method: "PATCH", body: JSON.stringify(data) });
  }

  getUser(userId: string) {
    return this.request<User>(`/users/${userId}`);
  }

  getUserPosts(userId: string) {
    return this.request<UserPost[]>(`/users/${userId}/posts`);
  }

  followUser(userId: string) {
    return this.request<{ following: boolean }>(`/users/${userId}/follow`, { method: "POST" });
  }

  getFollowStatus(userId: string) {
    return this.request<{ following: boolean }>(`/users/${userId}/follow/status`);
  }

  getFollowersCount(userId: string) {
    return this.request<{ count: number }>(`/users/${userId}/followers/count`);
  }

  getFollowingCount(userId: string) {
    return this.request<{ count: number }>(`/users/${userId}/following/count`);
  }
}

export const api = new ApiClient();
