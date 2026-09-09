import { useState } from "react";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface PostMediaCarouselProps {
  urls: string[];
  /** feed = cropped cover; detail = full image within viewport */
  mode?: "feed" | "detail";
  className?: string;
}

export default function PostMediaCarousel({
  urls,
  mode = "feed",
  className,
}: PostMediaCarouselProps) {
  const [idx, setIdx] = useState(0);
  if (!urls.length) return null;

  const isDetail = mode === "detail";

  return (
    <div className={cn("relative bg-asphalt", className)}>
      <img
        src={mediaUrl(urls[idx])}
        alt=""
        className={cn(
          "w-full",
          isDetail ? "max-h-[75vh] object-contain mx-auto" : "aspect-[4/3] object-cover",
        )}
        loading="lazy"
      />
      {urls.length > 1 && (
        <>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {urls.map((_, i) => (
              <span
                key={i}
                className={cn("w-1.5 h-1.5 rounded-full", i === idx ? "bg-white" : "bg-white/40")}
              />
            ))}
          </div>
          {idx > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIdx(idx - 1);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full text-white text-lg"
            >
              ‹
            </button>
          )}
          {idx < urls.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIdx(idx + 1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full text-white text-lg"
            >
              ›
            </button>
          )}
        </>
      )}
    </div>
  );
}
