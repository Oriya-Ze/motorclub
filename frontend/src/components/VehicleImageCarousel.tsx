import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import MediaLightbox from "@/components/MediaLightbox";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import { mediaUrl } from "@/lib/media";
import { pickStoredImageUrl } from "@/lib/postMedia";
import { cn } from "@/lib/utils";
import type { ImageMedia } from "@/lib/api";

interface VehicleImageCarouselProps {
  urls: string[];
  imageMedia?: ImageMedia[] | null;
  className?: string;
  imageClassName?: string;
  alt?: string;
}

export default function VehicleImageCarousel({ urls, imageMedia, className, imageClassName, alt }: VehicleImageCarouselProps) {
  const { t, i18n } = useTranslation();
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const rtl = i18n.dir() === "rtl";
  const label = alt || t("garage.title");
  const go = (next: number) => setIdx(Math.max(0, Math.min(urls.length - 1, next)));
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  if (!urls.length) {
    return <VehiclePlaceholder className={cn("h-56 sm:h-64 rounded-xl", className)} />;
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    touchStart.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    const towardNext = rtl ? dx < 0 : dx > 0;
    if (towardNext) go(idx + 1);
    else go(idx - 1);
  };

  return (
    <>
      <div
        className={cn("relative select-none touch-pan-y", className)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          className="block w-full"
          onClick={() => setLightbox(true)}
          aria-label={t("viewFullMedia")}
        >
          <img
            src={mediaUrl(pickStoredImageUrl(urls[idx], imageMedia, "detail"))}
            alt={t("garage.photoIndex", { n: idx + 1, total: urls.length, name: label })}
            className={cn("w-full h-56 sm:h-64 object-cover rounded-xl bg-asphalt", imageClassName)}
            draggable={false}
          />
        </button>

        {urls.length > 1 && (
          <>
            {idx > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(idx - 1);
                }}
                className="absolute start-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                aria-label={t("prevMedia")}
              >
                <PrevIcon className="w-5 h-5" />
              </button>
            )}
            {idx < urls.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(idx + 1);
                }}
                className="absolute end-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                aria-label={t("nextMedia")}
              >
                <NextIcon className="w-5 h-5" />
              </button>
            )}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {urls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIdx(i);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === idx ? "bg-white scale-110" : "bg-white/45 hover:bg-white/70"
                  )}
                  aria-label={t("garage.photoIndex", { n: i + 1, total: urls.length })}
                />
              ))}
            </div>
            <span className="absolute top-3 start-3 text-xs font-medium bg-black/50 text-white px-2 py-0.5 rounded-full">
              {idx + 1} / {urls.length}
            </span>
          </>
        )}
      </div>
      <MediaLightbox
        open={lightbox}
        items={urls.map((url) => ({
          kind: "image" as const,
          src: mediaUrl(pickStoredImageUrl(url, imageMedia, "detail")),
          alt: label,
        }))}
        index={idx}
        onClose={() => setLightbox(false)}
        onIndexChange={go}
      />
    </>
  );
}
