import { useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from "react";
import { mediaUrl } from "@/lib/media";
import { derivedImageVariantKey } from "@/lib/postMedia";
import { cn } from "@/lib/utils";

const RETRY_MS = 2000;
/** CloudFront keeps a 403 for a missing object about 10 seconds, so keep trying a little longer than that. */
const MAX_RETRIES = 8;
/**
 * Production serves only the processed copies: originals cost more to transfer, and for vehicles and posts the
 * media Lambda deletes them. Local development has no media Lambda, so it falls back to the original.
 */
const ALLOW_ORIGINAL = import.meta.env.DEV;

/**
 * An uploaded image by its source key, loaded from its processed copy (display, then thumb). A copy that is not
 * processed yet (the first seconds after upload) shows an empty frame and is retried, instead of loading the original.
 */
export default function StoredImage({
  sourceKey,
  preferredKey,
  alt = "",
  className,
  ...imgProps
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  sourceKey: string;
  /** Tried first, e.g. the exact thumbnail from the record's image_media. */
  preferredKey?: string | null;
  alt?: string;
  className?: string;
}) {
  const candidates = useMemo(() => {
    const display = derivedImageVariantKey(sourceKey, "display");
    const thumb = derivedImageVariantKey(sourceKey, "thumb");
    // A key with no processed copies (a static asset, or an unusual path) can only be shown as is.
    const original = ALLOW_ORIGINAL || (!display && !thumb) ? sourceKey : null;
    return Array.from(new Set([preferredKey, display, thumb, original].filter((key): key is string => Boolean(key)))).map(mediaUrl);
  }, [sourceKey, preferredKey]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<number>();
  const signature = candidates.join("|");

  useEffect(() => {
    setIndex(0);
    setAttempt(0);
    setWaiting(false);
  }, [signature]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleError = () => {
    if (index < candidates.length - 1) {
      setIndex(index + 1);
      return;
    }
    setWaiting(true);
    if (attempt >= MAX_RETRIES) return;
    timer.current = window.setTimeout(() => {
      setAttempt((current) => current + 1);
      setIndex(0);
      setWaiting(false);
    }, RETRY_MS);
  };

  if (waiting || !candidates.length) return <div className={cn("bg-black", className)} aria-hidden={!alt} />;
  // A new query string on each retry keeps the browser from reusing the failed response.
  const src = attempt ? `${candidates[index]}${candidates[index].includes("?") ? "&" : "?"}r=${attempt}` : candidates[index];
  return <img {...imgProps} src={src} alt={alt} className={className} onError={handleError} />;
}
