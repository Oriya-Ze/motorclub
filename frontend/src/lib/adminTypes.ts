/** Shapes returned by the /admin API, used only by the admin console. */

export interface AdminOverview {
  period_days: number;
  open_reports: number;
  pending_products: number;
  scan_errors: number;
  new_reports: number;
  pending_business_requests: number;
  videos_to_review: number;
  images_to_review: number;
  stuck_media: number;
  open_appeals: number;
  members: number;
  new_members: number;
}

export interface AdminReportTarget {
  exists: boolean;
  author: string | null;
  text: string;
  image: string | null;
  has_video?: boolean;
  status?: string;
  hidden?: boolean;
  suspended?: boolean;
  link: string;
}

export interface AdminReportGroup {
  target_type: "post" | "product" | "profile" | "story";
  target_id: string;
  count: number;
  reasons: string[];
  latest: string;
  status: string;
  reports: Array<{ id: string; reason: string; details: string | null; status: string; created_at: string }>;
  target: AdminReportTarget | null;
}

export type AdminMediaPreview =
  | { kind: "video"; status: string; poster: string | null; src: string }
  | { kind: "image"; url?: string | null; key?: string | null };

export interface AdminMediaItem {
  id: string;
  storage_key: string;
  kind: "image" | "video";
  decision: string;
  labels: Array<{ name: string; confidence?: number; parent?: string | null }>;
  error_message: string | null;
  created_at: string;
  owner: { id: string; username: string; full_name: string } | null;
  preview: AdminMediaPreview;
  used_in: Array<{ type: string; id: string }>;
}

export interface AdminUser {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  profile_picture_url: string | null;
  account_type: string;
  is_admin: boolean;
  is_moderator: boolean;
  is_verified: boolean;
  suspended_until: string | null;
  business_hidden: boolean;
  created_at: string | null;
}

export interface AdminAction {
  id: string;
  actor: string | null;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
}

export interface AdminAppeal {
  id: string;
  post_id: string;
  media_version: string;
  note: string | null;
  status: string;
  snapshot: Array<{ storage_key?: string | null; decision: string; reason_code?: string | null }>;
  created_at: string;
}
