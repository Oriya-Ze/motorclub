import type { MediaPurpose } from "@/lib/mediaUpload";
import { translateApiError, translateRateLimitError } from "@/lib/apiErrors";
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
  business_description?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
  business_website?: string | null;
  business_registration_id?: string | null;
  business_hours?: import("@/lib/businessProfile").BusinessHours | null;
  gallery_urls?: string[] | null;
  certifications?: string[] | null;
  service_area?: { cities?: string[]; radius_km?: number } | null;
  cover_image_url?: string | null;
  is_verified: boolean;
  is_admin?: boolean;
  profile_public?: boolean;
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
  turnstile_enabled?: boolean;
  turnstile_site_key?: string | null;
}

export interface UsernameCheckResult {
  username: string;
  valid: boolean;
  available: boolean;
  reason: string | null;
}

export interface VideoMedia {
  source_key: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  poster_key?: string | null;
  thumb_key?: string | null;
  url_480p?: string | null;
  url_720p?: string | null;
  url_1080p?: string | null;
  error_message?: string | null;
}

export interface ImageMedia {
  source_key: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  thumb_key?: string | null;
  display_key?: string | null;
  error_message?: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  content?: string | null;
  image_urls?: string[] | null;
  video_urls?: string[] | null;
  video_media?: VideoMedia[] | null;
  image_media?: ImageMedia[] | null;
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
  owner?: User;
}

export interface VehicleCatalogMake {
  id: string;
  name: string;
}

export interface VehicleCatalogModel {
  id: string;
  name: string;
  code: string;
}

export interface VehicleCatalogVariant {
  id: string;
  trim: string;
  engine: string;
  fuel?: string | null;
  engine_cc?: number | null;
  horsepower?: number | null;
  year_from?: number | null;
  year_to?: number | null;
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

export interface FollowStatus {
  following: boolean;
  status: "none" | "pending" | "accepted" | "cancelled" | string;
}

export interface FollowRequest {
  user_id: string;
  created_at: string;
  user: User;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  privacy?: "public" | "closed";
  members_count: number;
  is_member: boolean;
  my_status?: string | null;
  my_role?: string | null;
  can_manage?: boolean;
  pending_count?: number;
  creator_id: string;
  created_at?: string;
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

  private errorMessageFromBody(body: unknown, fallback: string): string {
    if (!body || typeof body !== "object" || !("detail" in body)) return fallback;
    const { detail } = body as { detail?: unknown };
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item)))
        .join(", ");
    }
    return fallback;
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
      const errorBody = await response.json().catch(() => null);
      const message = this.errorMessageFromBody(errorBody, "Unauthorized");
      this.setToken(null);
      if (!window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth";
      }
      throw new Error(translateApiError(message));
    }

    if (response.status === 429) {
      await response.json().catch(() => null);
      throw new Error(translateRateLimitError());
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(translateApiError(this.errorMessageFromBody(error, "Request failed")));
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  register(data: {
    email: string;
    username: string;
    full_name: string;
    password: string;
    captcha_token?: string;
  }) {
    return this.request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(data) });
  }

  confirmSignUp(data: { email: string; code: string; password: string }) {
    return this.request<AuthResponse>("/auth/confirm", { method: "POST", body: JSON.stringify(data) });
  }

  resendConfirmation(email: string) {
    return this.request<{ message: string }>("/auth/resend-confirmation", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  login(data: { email: string; password: string; captcha_token?: string }) {
    return this.request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) });
  }

  checkUsername(username: string) {
    const q = encodeURIComponent(username.trim());
    return this.request<UsernameCheckResult>(`/auth/check-username?username=${q}`);
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

  getVehicle(vehicleId: string) {
    return this.request<Vehicle>(`/garage/${vehicleId}`);
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

  getVehicleCatalogMakes() {
    return this.request<VehicleCatalogMake[]>("/vehicle-catalog/makes");
  }

  getVehicleCatalogModels(makeId: string) {
    return this.request<VehicleCatalogModel[]>(`/vehicle-catalog/makes/${makeId}/models`);
  }

  getVehicleCatalogVariants(makeId: string, modelId: string) {
    return this.request<VehicleCatalogVariant[]>(
      `/vehicle-catalog/makes/${makeId}/models/${modelId}/variants`
    );
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

  deletePost(postId: string) {
    return this.request<{ deleted: boolean }>(`/posts/${postId}`, { method: "DELETE" });
  }

  searchUsers(q: string) {
    return this.request<User[]>(`/users/search?q=${encodeURIComponent(q)}`);
  }

  getGroups() {
    return this.request<Group[]>("/groups");
  }

  getGroup(groupId: string) {
    return this.request<Group>(`/groups/${groupId}`);
  }

  getGroupMembers(groupId: string) {
    return this.request<Array<{ user_id: string; role: string; joined_at: string; user: User }>>(`/groups/${groupId}/members`);
  }

  createGroup(data: { name: string; description?: string; category?: string; privacy?: "public" | "closed" }) {
    return this.request<Group>("/groups", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getForums() {
    return this.request<Array<{ id: string; name: string; name_en?: string | null; description?: string | null; description_en?: string | null; icon?: string; topics_count: number }>>("/forums");
  }

  getForumTopics(forumId: string) {
    return this.request<ForumTopic[]>(`/forums/${forumId}/topics`);
  }

  getForumTopic(topicId: string) {
    return this.request<ForumTopic>(`/forums/topics/${topicId}`);
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

  getGroupJoinRequests(groupId: string) {
    return this.request<Array<{ user_id: string; role: string; joined_at: string; user: User }>>(
      `/groups/${groupId}/join-requests`,
    );
  }

  approveGroupJoinRequest(groupId: string, userId: string) {
    return this.request<{ status: string }>(`/groups/${groupId}/join-requests/${userId}/approve`, { method: "POST" });
  }

  rejectGroupJoinRequest(groupId: string, userId: string) {
    return this.request<{ status: string }>(`/groups/${groupId}/join-requests/${userId}/reject`, { method: "POST" });
  }

  leaveGroup(groupId: string) {
    return this.request<{ status: string }>(`/groups/${groupId}/leave`, { method: "POST" });
  }

  deleteGroup(groupId: string) {
    return this.request<{ deleted: boolean }>(`/groups/${groupId}`, { method: "DELETE" });
  }

  removeGroupMember(groupId: string, userId: string) {
    return this.request<{ removed: boolean }>(`/groups/${groupId}/members/${userId}`, { method: "DELETE" });
  }

  updateGroupMemberRole(groupId: string, userId: string, role: "member" | "admin") {
    return this.request<{ user_id: string; role: string }>(`/groups/${groupId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
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

  requestBusinessUpgrade(data: import("@/lib/businessTypes").BusinessUpgradeFormData) {
    return this.request<import("@/lib/businessTypes").BusinessUpgradeRequest>("/users/me/business-upgrade", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  getMyBusinessUpgrade() {
    return this.request<import("@/lib/businessTypes").BusinessUpgradeRequest | null>("/users/me/business-upgrade");
  }

  listBusinessUpgradeRequests(status = "pending") {
    return this.request<import("@/lib/businessTypes").BusinessUpgradeRequestAdmin[]>(
      `/admin/business-upgrade-requests?status=${encodeURIComponent(status)}`
    );
  }

  approveBusinessUpgrade(requestId: string, adminNotes?: string) {
    return this.request(`/admin/business-upgrade-requests/${requestId}/approve`, {
      method: "POST",
      body: JSON.stringify({ admin_notes: adminNotes ?? null }),
    });
  }

  rejectBusinessUpgrade(requestId: string, rejectionReason: string, adminNotes?: string) {
    return this.request(`/admin/business-upgrade-requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: rejectionReason, admin_notes: adminNotes ?? null }),
    });
  }

  getEvents() {
    return this.request<Array<{
      id: string; creator_id: string; title: string; description?: string; event_type: string;
      location?: string; event_date: string; event_end_date?: string | null;
      max_participants?: number;
      participants_count: number; is_joined: boolean;
    }>>("/events");
  }

  joinEvent(eventId: string) {
    return this.request<{ joined: boolean }>(`/events/${eventId}/join`, { method: "POST" });
  }

  leaveEvent(eventId: string) {
    return this.request<{ joined: boolean }>(`/events/${eventId}/leave`, { method: "POST" });
  }

  deleteEvent(eventId: string) {
    return this.request<{ deleted: boolean }>(`/events/${eventId}`, { method: "DELETE" });
  }

  createEvent(data: {
    title: string;
    description?: string;
    event_type: string;
    location?: string;
    event_date: string;
    event_end_date?: string;
    max_participants?: number;
    image_url?: string;
  }) {
    return this.request<{
      id: string;
      title: string;
      description?: string;
      event_type: string;
      location?: string;
      event_date: string;
      event_end_date?: string | null;
      max_participants?: number;
      participants_count: number;
      is_joined: boolean;
    }>("/events", { method: "POST", body: JSON.stringify(data) });
  }

  getProducts(opts?: { category?: string; businessId?: string }) {
    const params = new URLSearchParams();
    if (opts?.category) params.set("category", opts.category);
    if (opts?.businessId) params.set("business_id", opts.businessId);
    const q = params.toString() ? `?${params}` : "";
    return this.request<Product[]>(`/marketplace${q}`);
  }

  getMyProducts() {
    return this.request<Product[]>("/marketplace/mine");
  }

  createProduct(data: {
    name: string;
    description?: string;
    price: number;
    category: string;
    image_urls?: string[];
  }) {
    return this.request<Product>("/marketplace", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  deleteProduct(productId: string) {
    return this.request<{ deleted: boolean }>(`/marketplace/${productId}`, { method: "DELETE" });
  }

  updateProduct(
    productId: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      category?: string;
      image_urls?: string[];
    }
  ) {
    return this.request<Product>(`/marketplace/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  getBusinesses(opts?: { businessType?: string; q?: string }) {
    const params = new URLSearchParams();
    if (opts?.businessType) params.set("business_type", opts.businessType);
    if (opts?.q) params.set("q", opts.q);
    const q = params.toString() ? `?${params}` : "";
    return this.request<import("@/lib/businessProfile").BusinessPublic[]>(`/businesses${q}`);
  }

  getServices(opts?: { businessType?: string; q?: string }) {
    const params = new URLSearchParams();
    if (opts?.businessType) params.set("business_type", opts.businessType);
    if (opts?.q) params.set("q", opts.q);
    const q = params.toString() ? `?${params}` : "";
    return this.request<import("@/lib/businessProfile").BusinessPublic[]>(`/services${q}`);
  }

  getService(userId: string) {
    return this.request<import("@/lib/businessProfile").BusinessPublic>(`/services/${userId}`);
  }

  getWorkshops(opts?: { specialty?: string; q?: string }) {
    const params = new URLSearchParams();
    if (opts?.specialty) params.set("business_type", opts.specialty);
    if (opts?.q) params.set("q", opts.q);
    const q = params.toString() ? `?${params}` : "";
    return this.request<import("@/lib/businessProfile").BusinessPublic[]>(`/workshops${q}`);
  }

  getWorkshop(userId: string) {
    return this.request<import("@/lib/businessProfile").BusinessPublic>(`/workshops/${userId}`);
  }

  getBusiness(userId: string) {
    return this.request<import("@/lib/businessProfile").BusinessPublic>(`/business/${userId}`);
  }

  getBusinessServices(userId: string) {
    return this.request<import("@/lib/businessProfile").BusinessService[]>(`/business/${userId}/services`);
  }

  getMyBusinessServices() {
    return this.request<import("@/lib/businessProfile").BusinessService[]>("/business/me/services");
  }

  createBusinessService(data: {
    name: string;
    description?: string;
    price_from?: number;
    duration_minutes?: number;
    sort_order?: number;
    is_active?: boolean;
  }) {
    return this.request<import("@/lib/businessProfile").BusinessService>("/business/me/services", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  updateBusinessService(
    serviceId: string,
    data: {
      name?: string;
      description?: string;
      price_from?: number;
      duration_minutes?: number;
      sort_order?: number;
      is_active?: boolean;
    }
  ) {
    return this.request<import("@/lib/businessProfile").BusinessService>(`/business/me/services/${serviceId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  deleteBusinessService(serviceId: string) {
    return this.request<{ deleted: boolean }>(`/business/me/services/${serviceId}`, { method: "DELETE" });
  }

  getBusinessReviews(userId: string) {
    return this.request<import("@/lib/businessProfile").BusinessReview[]>(`/business/${userId}/reviews`);
  }

  createBusinessReview(userId: string, data: { rating: number; text?: string }) {
    return this.request<import("@/lib/businessProfile").BusinessReview>(`/business/${userId}/reviews`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  recordBusinessEvent(userId: string, eventType: string) {
    return this.request<{ ok: boolean }>(`/business/${userId}/events`, {
      method: "POST",
      body: JSON.stringify({ event_type: eventType }),
    });
  }

  getBusinessAnalytics() {
    return this.request<import("@/lib/businessProfile").BusinessAnalytics>("/business/me/analytics");
  }

  updateProfile(data: {
    full_name?: string;
    username?: string;
    profile_picture_url?: string;
    cover_image_url?: string;
    business_type?: string;
    business_description?: string;
    business_phone?: string;
    business_address?: string;
    business_website?: string;
    business_registration_id?: string;
    business_hours?: import("@/lib/businessProfile").BusinessHours;
    gallery_urls?: string[];
    certifications?: string[];
    service_area?: { cities?: string[]; radius_km?: number };
  }) {
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
    return this.request<FollowStatus>(`/users/${userId}/follow`, { method: "POST" });
  }

  getFollowStatus(userId: string) {
    return this.request<FollowStatus>(`/users/${userId}/follow/status`);
  }

  getFollowRequests() {
    return this.request<FollowRequest[]>("/users/me/follow-requests");
  }

  approveFollowRequest(followerId: string) {
    return this.request<{ status: string }>(`/users/me/follow-requests/${followerId}/approve`, { method: "POST" });
  }

  rejectFollowRequest(followerId: string) {
    return this.request<{ status: string }>(`/users/me/follow-requests/${followerId}/reject`, { method: "POST" });
  }

  getFollowersCount(userId: string) {
    return this.request<{ count: number }>(`/users/${userId}/followers/count`);
  }

  getFollowingCount(userId: string) {
    return this.request<{ count: number }>(`/users/${userId}/following/count`);
  }
}

export const api = new ApiClient();
export type { BusinessUpgradeFormData, BusinessUpgradeRequest, BusinessUpgradeRequestAdmin } from "@/lib/businessTypes";
