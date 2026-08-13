import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";

interface VehicleImageCarouselProps {
  urls: string[];
  className?: string;
  imageClassName?: string;
}

export default function VehicleImageCarousel({ urls, className, imageClassName }: VehicleImageCarouselProps) {
  const [idx, setIdx] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (!urls.length) {
    return <VehiclePlaceholder className={cn("h-56 sm:h-64 rounded-xl", className)} />;
  }

  const go = (next: number) => setIdx(Math.max(0, Math.min(urls.length - 1, next)));

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    touchStart.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) go(idx + 1);
    else go(idx - 1);
  };

  return (
    <div
      className={cn("relative select-none touch-pan-y", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <img
        src={mediaUrl(urls[idx])}
        alt=""
        className={cn("w-full h-56 sm:h-64 object-cover rounded-xl bg-asphalt", imageClassName)}
        draggable={false}
      />

      {urls.length > 1 && (
        <>
          {idx > 0 && (
            <button
              type="button"
              onClick={() => go(idx - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {idx < urls.length - 1 && (
            <button
              type="button"
              onClick={() => go(idx + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === idx ? "bg-white scale-110" : "bg-white/45 hover:bg-white/70"
                )}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>

          <span className="absolute top-3 left-3 text-xs font-medium bg-black/50 text-white px-2 py-0.5 rounded-full">
            {idx + 1} / {urls.length}
          </span>
        </>
      )}
    </div>
  );
}
