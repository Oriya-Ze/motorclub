import type { Post, VideoMedia } from "@/lib/api";

export type PostMediaItem =
  | { type: "image"; url: string }
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

export function postMediaFromPost(
  post: Pick<Post, "image_urls" | "video_urls" | "video_media">,
): PostMediaItem[] {
  const items: PostMediaItem[] = [];
  for (const url of post.image_urls ?? []) {
    if (url) items.push({ type: "image", url });
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
