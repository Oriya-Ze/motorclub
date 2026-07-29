import { API_BASE } from "@/lib/media";

export type MediaPurpose = "post" | "story" | "vehicle" | "avatar";
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
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

// TODO(orphan-cleanup): A future worker should delete storage objects that were
// uploaded successfully but never referenced by a domain record (e.g. after a
// failed createPost/createStory/createVehicle call). No deletion API in Phase 3.

type AuthenticatedRequest = <T>(path: string, options?: RequestInit) => Promise<T>;

function normalizeContentType(file: File): string {
  return (file.type || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
}

export function inferMediaType(file: File): MediaType {
  const contentType = normalizeContentType(file);
  if ((SUPPORTED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return "image";
  }
  if ((SUPPORTED_VIDEO_TYPES as readonly string[]).includes(contentType)) {
    return "video";
  }
  throw new MediaUploadError("Unsupported file type", "unsupported_type");
}

export function validateFileBeforeUpload(file: File): MediaType {
  const mediaType = inferMediaType(file);
  const limit = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size <= 0) {
    throw new MediaUploadError("File is empty", "empty_file");
  }
  if (file.size > limit) {
    throw new MediaUploadError(`File too large (max ${limit / (1024 * 1024)}MB)`, "file_too_large");
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
): Promise<MediaUploadRequestResponse> {
  const contentType = normalizeContentType(file);
  return request<MediaUploadRequestResponse>("/media/upload-requests", {
    method: "POST",
    body: JSON.stringify({
      purpose,
      content_type: contentType,
      size_bytes: file.size,
      filename: file.name || undefined,
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
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: requiredHeaders,
    body: file,
  });

  if (!response.ok) {
    throw new MediaUploadError("Upload failed. Please try again.", "s3_put_failed");
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
  validateFileBeforeUpload(file);

  const instruction = await requestUploadInstruction(deps.request, file, purpose);

  if (instruction.upload_method === "multipart") {
    const uploadPath = instruction.upload_path || "/api/v1/uploads";
    return uploadLocalMultipart(deps.getToken, uploadPath, file);
  }

  if (instruction.upload_method === "PUT") {
    if (!instruction.upload_url || !instruction.storage_key) {
      throw new MediaUploadError("Invalid upload instructions", "invalid_instruction");
    }
    await uploadToPresignedUrl(instruction.upload_url, file, instruction.required_headers);
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
