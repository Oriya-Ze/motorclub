import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import FitImage from "@/components/FitImage";
import StoredImage from "@/components/StoredImage";
import { API_BASE } from "@/lib/media";
import { derivedImageVariantKey } from "@/lib/postMedia";
import { cn } from "@/lib/utils";

/**
 * An image the viewer owns, including one still in the private path while it waits for review.
 * Private keys have no public URL, so they are read through the owner-only access endpoint; public ones come
 * from their processed thumbnail.
 */
export default function OwnerMediaThumb({ storageKey, className }: { storageKey: string; className?: string }) {
  const isPrivate = storageKey.includes("/private/");
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!isPrivate) return;
    let stop = false;
    let blobUrl = "";
    api.mediaAccessUrl(storageKey).then(async (result) => {
      const target = result.url.startsWith("/") ? `${API_BASE}${result.url}` : result.url;
      if (result.url.startsWith("http")) {
        if (!stop) setSrc(target);
        return;
      }
      const response = await fetch(target, { headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` } });
      if (!response.ok) throw new Error("preview failed");
      blobUrl = URL.createObjectURL(await response.blob());
      if (!stop) setSrc(blobUrl);
    }).catch(() => {
      if (!stop) setSrc("");
    });
    return () => {
      stop = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [storageKey, isPrivate]);
  if (!isPrivate) return <StoredImage sourceKey={storageKey} preferredKey={derivedImageVariantKey(storageKey, "thumb")} className={className} />;
  if (!src) return <div className={cn("bg-muted", className)} />;
  return <FitImage src={src} alt="" className={cn("bg-muted", className)} />;
}
