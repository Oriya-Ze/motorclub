import type { ImageMedia, Post, VideoMedia } from "@/lib/api";

export type PostMediaItem =
  | { type: "image"; url: string; image?: ImageMedia | null }
  | { type: "video"; url: string; video?: VideoMedia | null };

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
}

/** Feed: 480p mobile, 720p desktop. Full post: 720p mobile, 1080p desktop. */
export function pickVideoPlaybackUrl(
  item: Extract<PostMediaItem, { type: "video" }>,
  mode: "feed" | "detail",
): string | null {
  const video = item.video;
  if (video?.status === "ready") {
    const mobile = isMobileViewport();
    if (mode === "feed") {
      return mobile
        ? (video.url_480p ?? video.url_720p ?? video.url_1080p ?? item.url)
        : (video.url_720p ?? video.url_1080p ?? video.url_480p ?? item.url);
    }
    return mobile
      ? (video.url_720p ?? video.url_1080p ?? video.url_480p ?? item.url)
      : (video.url_1080p ?? video.url_720p ?? video.url_480p ?? item.url);
  }
  if (video?.status === "failed") {
    return null;
  }
  return item.url;
}

const SOURCE_KEY_RE =
  /^users\/([0-9a-f-]{36})\/(?:posts|stories|vehicles|avatar|products)\/([0-9a-f-]{36})\.[a-z0-9]+$/i;

export function derivedImageVariantKey(sourceKey: string, variant: "thumb" | "display"): string | null {
  const match = sourceKey.match(SOURCE_KEY_RE);
  if (!match) return null;
  return `users/${match[1]}/images/${match[2]}/${variant}.webp`;
}

export function pickImageUrl(
  item: Extract<PostMediaItem, { type: "image" }>,
  mode: "feed" | "detail",
): string {
  const image = item.image;
  if (image?.status === "ready") {
    if (mode === "feed") {
      return image.thumb_key ?? image.display_key ?? item.url;
    }
    return image.display_key ?? image.thumb_key ?? item.url;
  }
  const variant = mode === "feed" ? "thumb" : "display";
  if (variant === "thumb" && image?.thumb_key) return image.thumb_key;
  return derivedImageVariantKey(item.url, variant) ?? item.url;
}

export function pickStoredImageUrl(
  sourceKey: string | null | undefined,
  media: ImageMedia[] | null | undefined,
  mode: "feed" | "detail",
): string {
  if (!sourceKey) return "";
  const image = media?.find((item) => item.source_key === sourceKey) ?? null;
  return pickImageUrl({ type: "image", url: sourceKey, image }, mode);
}

export function postMediaFromPost(
  post: Pick<Post, "image_urls" | "video_urls" | "video_media" | "image_media">,
): PostMediaItem[] {
  const items: PostMediaItem[] = [];
  const imageByKey = new Map((post.image_media ?? []).map((image) => [image.source_key, image]));
  for (const url of post.image_urls ?? []) {
    if (url) items.push({ type: "image", url, image: imageByKey.get(url) ?? null });
  }

  const videoByKey = new Map((post.video_media ?? []).map((video) => [video.source_key, video]));
  for (const url of post.video_urls ?? []) {
    if (url) {
      items.push({ type: "video", url, video: videoByKey.get(url) ?? null });
    }
  }
  return items;
}

export function postHasMedia(
  post: Pick<Post, "image_urls" | "video_urls">,
): boolean {
  return (post.image_urls?.length ?? 0) > 0 || (post.video_urls?.length ?? 0) > 0;
}
