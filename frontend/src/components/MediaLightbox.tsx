import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type FullMediaItem =
  | { kind: "image"; src: string; alt?: string }
  | { kind: "video"; src: string; poster?: string };

type Props = {
  open: boolean;
  items: FullMediaItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export default function MediaLightbox({ open, items, index, onClose, onIndexChange }: Props) {
  const { t, i18n } = useTranslation();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const rtl = i18n.dir() === "rtl";
  const item = items[index];
  const PrevIcon = rtl ? ChevronRight : ChevronLeft;
  const NextIcon = rtl ? ChevronLeft : ChevronRight;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const delta = e.key === "ArrowLeft" ? (rtl ? 1 : -1) : e.key === "ArrowRight" ? (rtl ? -1 : 1) : 0;
      if (!delta) return;
      const next = index + delta;
      if (next >= 0 && next < items.length) onIndexChange(next);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, index, rtl, onClose, onIndexChange]);

  if (!open || !item) return null;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    onIndexChange(clamped);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = touchStart.current.x - e.changedTouches[0].clientX;
    const dy = touchStart.current.y - e.changedTouches[0].clientY;
    touchStart.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    const towardNext = rtl ? dx < 0 : dx > 0;
    if (towardNext) go(index + 1);
    else go(index - 1);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={t("viewFullMedia")}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        className="absolute top-4 end-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        onClick={onClose}
        aria-label={t("close")}
      >
        <X className="w-5 h-5" />
      </button>

      {items.length > 1 && (
        <span className="absolute top-5 start-5 z-10 text-sm font-medium text-white/80">
          {index + 1} / {items.length}
        </span>
      )}

      {index > 0 && (
        <button
          type="button"
          onClick={() => go(index - 1)}
          className="absolute start-3 sm:start-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          aria-label={t("prevMedia")}
        >
          <PrevIcon className="w-6 h-6" />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          type="button"
          onClick={() => go(index + 1)}
          className="absolute end-3 sm:end-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          aria-label={t("nextMedia")}
        >
          <NextIcon className="w-6 h-6" />
        </button>
      )}

      <div className="relative z-[1] flex h-full w-full items-center justify-center p-4 sm:p-10">
        {item.kind === "video" ? (
          <video
            key={item.src}
            src={item.src}
            poster={item.poster}
            className={cn("max-h-full max-w-full object-contain")}
            controls
            autoPlay
            playsInline
          />
        ) : (
          <img
            src={item.src}
            alt={item.alt ?? t("viewFullMedia")}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
