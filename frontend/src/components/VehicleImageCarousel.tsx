import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";

interface VehicleImageCarouselProps {
  urls: string[];
  className?: string;
  imageClassName?: string;
  alt?: string;
}

export default function VehicleImageCarousel({ urls, className, imageClassName, alt }: VehicleImageCarouselProps) {
  const { t, i18n } = useTranslation();
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const rtl = i18n.dir() === "rtl";
  const label = alt || t("garage.title");
  const go = (next: number) => setIdx((cur) => {
    const target = typeof next === "number" && Number.isFinite(next) ? next : cur;
    return Math.max(0, Math.min(urls.length - 1, target));
  });

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowLeft") go(idx + (rtl ? 1 : -1));
      if (e.key === "ArrowRight") go(idx + (rtl ? -1 : 1));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox, idx, rtl, urls.length]);

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

  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;

  const frame = (
    <div
      className={cn("relative select-none touch-pan-y", className)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        className="block w-full"
        onClick={() => setLightbox(true)}
        aria-label={t("garage.viewPhoto")}
      >
        <img
          src={mediaUrl(urls[idx])}
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
              aria-label={t("garage.prevPhoto")}
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
              aria-label={t("garage.nextPhoto")}
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
  );

  return (
    <>
      {frame}
      {lightbox
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <button
                type="button"
                className="absolute inset-0 bg-black/85"
                onClick={() => setLightbox(false)}
                aria-label={t("close")}
              />
              <button
                type="button"
                onClick={() => setLightbox(false)}
                className="absolute top-4 end-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label={t("close")}
              >
                <X className="w-5 h-5" />
              </button>
              {idx > 0 && (
                <button
                  type="button"
                  onClick={() => go(idx - 1)}
                  className="absolute start-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
                  aria-label={t("garage.prevPhoto")}
                >
                  <PrevIcon className="w-6 h-6" />
                </button>
              )}
              {idx < urls.length - 1 && (
                <button
                  type="button"
                  onClick={() => go(idx + 1)}
                  className="absolute end-4 z-10 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center"
                  aria-label={t("garage.nextPhoto")}
                >
                  <NextIcon className="w-6 h-6" />
                </button>
              )}
              <img
                src={mediaUrl(urls[idx])}
                alt={t("garage.photoIndex", { n: idx + 1, total: urls.length, name: label })}
                className="relative z-[1] max-h-[90vh] max-w-[92vw] object-contain"
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
