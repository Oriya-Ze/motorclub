import { derivedImageVariantKey, sourceMediaIds } from "@/lib/postMedia";

function unique(keys: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

/** Processed display first, then the uploaded file while it still exists. */
export function imageViewKeys(sourceKey: string): string[] {
  return unique([
    derivedImageVariantKey(sourceKey, "display"),
    derivedImageVariantKey(sourceKey, "thumb"),
    sourceKey,
  ]);
}

/** Processed playback first. The uploaded file is the fallback before transcode deletes it. */
export function videoPlayKeys(sourceKey: string): string[] {
  const ids = sourceMediaIds(sourceKey);
  if (!ids) return [sourceKey];
  const base = `users/${ids.userId}/videos/${ids.mediaId}`;
  return unique([
    `${base}/720p.mp4`,
    `${base}/480p.mp4`,
    `${base}/1080p.mp4`,
    sourceKey,
  ]);
}

export function videoPosterKey(sourceKey: string): string | null {
  const ids = sourceMediaIds(sourceKey);
  if (!ids) return null;
  return `users/${ids.userId}/videos/${ids.mediaId}/poster.webp`;
}
