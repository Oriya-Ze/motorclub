import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ImageFit = "smart" | "contain" | "cover";

/**
 * How much of the photo may be cut to fill its frame. Filling is preferred; black bars (the frame's background)
 * appear only when filling would cut more than this, e.g. a portrait photo in a wide frame.
 */
const MIN_KEPT = 0.7;

/**
 * An <img> that fills its frame unless that would cut too much of the photo, in which case it shows the whole
 * photo on the frame's (black) background. The frame is the <img> box itself, sized by its classes.
 */
const FitImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement> & { fit?: ImageFit }>(function FitImage(
  { fit = "smart", className, onLoad, ...props },
  forwardedRef,
) {
  const ref = useRef<HTMLImageElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current as HTMLImageElement);
  const [smart, setSmart] = useState<"cover" | "contain">("cover");

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el || !el.naturalWidth || !el.naturalHeight || !el.clientWidth || !el.clientHeight) return;
    const photo = el.naturalWidth / el.naturalHeight;
    const frame = el.clientWidth / el.clientHeight;
    const kept = Math.min(photo, frame) / Math.max(photo, frame);
    setSmart(kept >= MIN_KEPT ? "cover" : "contain");
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (fit !== "smart" || !el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit, measure]);

  const mode = fit === "smart" ? smart : fit;
  return (
    <img
      ref={ref}
      {...props}
      onLoad={(event) => {
        measure();
        onLoad?.(event);
      }}
      className={cn(className, mode === "cover" ? "object-cover" : "object-contain")}
    />
  );
});

export default FitImage;
