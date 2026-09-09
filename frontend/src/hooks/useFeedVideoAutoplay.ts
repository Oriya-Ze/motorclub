import { useEffect, type RefObject } from "react";
import {
  pauseVideoAutoplay,
  registerVideoAutoplay,
  setVideoAutoplayEnabled,
  setVideoVisibility,
} from "@/lib/videoAutoplayCoordinator";

export function useFeedVideoAutoplay(
  id: string,
  containerRef: RefObject<HTMLElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  isActiveSlide: boolean,
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const unregister = registerVideoAutoplay(id, video, enabled && isActiveSlide);
    return unregister;
  }, [id, enabled, isActiveSlide, videoRef]);

  useEffect(() => {
    setVideoAutoplayEnabled(id, enabled && isActiveSlide);
  }, [id, enabled, isActiveSlide]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled || !isActiveSlide) {
      pauseVideoAutoplay(id);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setVideoVisibility(id, entry?.intersectionRatio ?? 0),
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    );

    observer.observe(container);
    return () => {
      observer.disconnect();
      pauseVideoAutoplay(id);
    };
  }, [id, enabled, isActiveSlide, containerRef]);

  useEffect(() => {
    if (!isActiveSlide) {
      videoRef.current?.pause();
      pauseVideoAutoplay(id);
    }
  }, [id, isActiveSlide, videoRef]);
}
