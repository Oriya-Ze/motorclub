import { useEffect, useMemo, useState } from "react";
import { mediaUrl } from "@/lib/media";
import { imageViewKeys } from "@/lib/mediaVariants";
import { derivedImageVariantKey } from "@/lib/postMedia";
import { cn } from "@/lib/utils";

/**
 * An uploaded image by its source key. For vehicles and posts the media Lambda replaces the original with
 * display.webp and thumb.webp a few seconds after upload, so this tries the processed copies first and falls
 * back to the original, which only exists until processing finishes (and always exists locally).
 */
export default function StoredImage({
  sourceKey,
  preferredKey,
  alt = "",
  className,
}: {
  sourceKey: string;
  /** Tried first, e.g. the exact thumbnail from the record's image_media. */
  preferredKey?: string | null;
  alt?: string;
  className?: string;
}) {
  const candidates = useMemo(
    () => Array.from(new Set([preferredKey, ...imageViewKeys(sourceKey)].filter((key): key is string => Boolean(key)))).map(mediaUrl),
    [sourceKey, preferredKey],
  );
  const [index, setIndex] = useState(0);
  const signature = candidates.join("|");
  useEffect(() => setIndex(0), [signature]);
  if (index >= candidates.length) return <div className={cn("bg-muted", className)} aria-hidden={!alt} />;
  return <img src={candidates[index]} alt={alt} className={className} onError={() => setIndex((current) => current + 1)} />;
}

/** The best stored copy of an image as a File, for cropping: the display copy, then the original, then the thumbnail. */
export async function loadStoredImageFile(sourceKey: string): Promise<File | null> {
  const keys = [derivedImageVariantKey(sourceKey, "display"), sourceKey, derivedImageVariantKey(sourceKey, "thumb")];
  for (const key of keys.filter((item): item is string => Boolean(item))) {
    try {
      const response = await fetch(mediaUrl(key));
      if (!response.ok) continue;
      const blob = await response.blob();
      return new File([blob], "vehicle.jpg", { type: blob.type || "image/jpeg" });
    } catch {
      // try the next copy
    }
  }
  return null;
}
