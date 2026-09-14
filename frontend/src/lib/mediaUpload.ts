import { resizeImageForUpload } from "@/lib/resizeImage";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export type MediaPurpose = "post" | "story" | "vehicle" | "avatar" | "product";
export type MediaType = "image" | "video";
export type UploadMethod = "PUT" | "multipart";

export interface MediaUploadRequestBody {
  purpose: MediaPurpose;
  content_type: string;
  size_bytes: number;
  filename?: string;
}

export interface MediaUploadRequestResponse {
  storage_key: string | null;
  media_type: MediaType;
  purpose: MediaPurpose;
  upload_method: UploadMethod;
  upload_url: string | null;
  upload_path: string | null;
  required_headers: Record<string, string>;
  expires_in: number | null;
}

export interface UploadMediaResult {
  reference: string;
  mediaType: MediaType;
}

export class MediaUploadError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Camera recordings on mobile are often 15–50MB before server-side transcode (Phase B2). */
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

// TODO(orphan-cleanup): A future worker should delete storage objects that were
// uploaded successfully but never referenced by a domain record (e.g. after a
// failed createPost/createStory/createVehicle call). No deletion API in Phase 3.

type AuthenticatedRequest = <T>(path: string, options?: RequestInit) => Promise<T>;

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function normalizeContentType(file: File): string {
  return (file.type || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
}

export function resolveUploadContentType(file: File): string {
  const contentType = normalizeContentType(file);
  if (contentType !== "application/octet-stream") return contentType;
  const fromExt = EXTENSION_TO_MIME[fileExtension(file.name)];
  return fromExt ?? contentType;
}

export function inferMediaType(file: File): MediaType {
  const contentType = resolveUploadContentType(file);
  if ((SUPPORTED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return "image";
  }
  if ((SUPPORTED_VIDEO_TYPES as readonly string[]).includes(contentType)) {
    return "video";
  }
  if (contentType.startsWith("video/")) {
    return "video";
  }
  const ext = fileExtension(file.name);
  if ([".mp4", ".mov", ".webm"].includes(ext)) {
    return "video";
  }
  throw new MediaUploadError("Unsupported file type", "unsupported_type");
}

function alignedMediaFilename(name: string, contentType: string, mediaType: MediaType): string {
  const ext = MIME_TO_EXTENSION[contentType] ?? (mediaType === "video" ? ".mp4" : ".jpg");
  const stem = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : name;
  const base = stem.trim() || (mediaType === "video" ? "video" : "photo");
  return `${base}${ext}`;
}

/** Normalize mobile camera files that omit MIME type or use generic octet-stream. */
export function normalizeMediaFile(file: File, mediaType: MediaType): File {
  let contentType = resolveUploadContentType(file);
  if (contentType === "application/octet-stream" || contentType.startsWith("video/")) {
    if (mediaType === "video") {
      const ext = fileExtension(file.name);
      contentType =
        ext === ".mov"
          ? "video/quicktime"
          : ext === ".webm"
            ? "video/webm"
            : "video/mp4";
    } else {
      contentType = "image/jpeg";
    }
  }

  const filename = alignedMediaFilename(file.name || "", contentType, mediaType);
  if (file.name === filename && file.type === contentType) return file;

  return new File([file], filename, {
    type: contentType,
    lastModified: file.lastModified,
  });
}

export function validateFileBeforeUpload(file: File): MediaType {
  const mediaType = inferMediaType(file);
  const limit = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size <= 0) {
    throw new MediaUploadError("File is empty", "empty_file");
  }
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    throw new MediaUploadError(`File too large (max ${mb}MB)`, mediaType === "video" ? "video_too_large" : "file_too_large");
  }
  return mediaType;
}

async function parseApiError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({ detail: "Request failed" }));
  const detail = body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item.msg || String(item)).join(", ");
  }
  return "Request failed";
}

async function requestUploadInstruction(
  request: AuthenticatedRequest,
  file: File,
  purpose: MediaPurpose,
  mediaType: MediaType,
): Promise<MediaUploadRequestResponse> {
  const normalizedFile = normalizeMediaFile(file, mediaType);
  const contentType = resolveUploadContentType(normalizedFile);
  return request<MediaUploadRequestResponse>("/media/upload-requests", {
    method: "POST",
    body: JSON.stringify({
      purpose,
      content_type: contentType,
      size_bytes: normalizedFile.size,
      filename: normalizedFile.name || undefined,
    }),
  });
}

async function uploadLocalMultipart(
  getToken: () => string | null,
  uploadPath: string,
  file: File,
): Promise<UploadMediaResult> {
  const token = getToken();
  if (!token) {
    throw new MediaUploadError("Not authenticated", "unauthorized");
  }

  const form = new FormData();
  form.append("file", file);

  const url = uploadPath.startsWith("http") ? uploadPath : `${API_BASE}${uploadPath}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    throw new MediaUploadError(await parseApiError(response), "multipart_failed");
  }

  const body = (await response.json()) as { url: string; type: MediaType };
  return { reference: body.url, mediaType: body.type };
}

async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
  requiredHeaders: Record<string, string>,
): Promise<void> {
  const headers = { ...requiredHeaders };
  if (headers["Content-Type"]) {
    headers["Content-Type"] = headers["Content-Type"].split(";", 1)[0].trim();
  }

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new MediaUploadError("Video upload failed", "s3_put_failed");
  }
}

export async function uploadMedia(
  file: File,
  purpose: MediaPurpose,
  deps: {
    request: AuthenticatedRequest;
    getToken: () => string | null;
  },
): Promise<UploadMediaResult> {
  let mediaType = validateFileBeforeUpload(file);
  let normalizedFile = normalizeMediaFile(file, mediaType);
  if (mediaType === "image") {
    try {
      normalizedFile = normalizeMediaFile(await resizeImageForUpload(normalizedFile), "image");
      mediaType = validateFileBeforeUpload(normalizedFile);
    } catch {
      // Keep the original file if canvas resize fails (e.g. GIF/HEIC edge cases).
    }
  }

  const instruction = await requestUploadInstruction(deps.request, normalizedFile, purpose, mediaType);

  if (instruction.upload_method === "multipart") {
    const uploadPath = instruction.upload_path || "/api/v1/uploads";
    return uploadLocalMultipart(deps.getToken, uploadPath, normalizedFile);
  }

  if (instruction.upload_method === "PUT") {
    if (!instruction.upload_url || !instruction.storage_key) {
      throw new MediaUploadError("Invalid upload instructions", "invalid_instruction");
    }
    await uploadToPresignedUrl(instruction.upload_url, normalizedFile, instruction.required_headers);
    return {
      reference: instruction.storage_key,
      mediaType: instruction.media_type,
    };
  }

  throw new MediaUploadError("Unsupported upload method", "unsupported_method");
}

export async function uploadMediaFiles(
  files: File[],
  purpose: MediaPurpose,
  deps: {
    request: AuthenticatedRequest;
    getToken: () => string | null;
  },
): Promise<UploadMediaResult[]> {
  const results: UploadMediaResult[] = [];
  for (const file of files) {
    results.push(await uploadMedia(file, purpose, deps));
  }
  return results;
}
