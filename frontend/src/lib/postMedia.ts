import type { Post } from "@/lib/api";

export type PostMediaItem =
  | { type: "image"; url: string }
  | { type: "video"; url: string };

export function postMediaFromPost(post: Pick<Post, "image_urls" | "video_urls">): PostMediaItem[] {
  const items: PostMediaItem[] = [];
  for (const url of post.image_urls ?? []) {
    if (url) items.push({ type: "image", url });
  }
  for (const url of post.video_urls ?? []) {
    if (url) items.push({ type: "video", url });
  }
  return items;
}

export function postHasMedia(post: Pick<Post, "image_urls" | "video_urls">): boolean {
  return (post.image_urls?.length ?? 0) > 0 || (post.video_urls?.length ?? 0) > 0;
}
