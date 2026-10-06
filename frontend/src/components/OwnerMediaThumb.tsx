import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { API_BASE, mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * An image the viewer owns, including one still in the private path while it waits for review.
 * Private keys have no public URL, so they are read through the owner-only access endpoint.
 */
export default function OwnerMediaThumb({ storageKey, className }: { storageKey: string; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!storageKey.includes("/private/")) {
      setSrc(mediaUrl(storageKey));
      return;
    }
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
  }, [storageKey]);
  if (!src) return <div className={cn("bg-muted", className)} />;
  return <img src={src} alt="" className={cn("bg-muted", className)} />;
}
