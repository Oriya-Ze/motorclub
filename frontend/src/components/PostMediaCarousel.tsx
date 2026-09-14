import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useId, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useFeedVideoAutoplay } from "@/hooks/useFeedVideoAutoplay";
import { pickImageUrl, pickVideoPlaybackUrl, type PostMediaItem } from "@/lib/postMedia";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface PostMediaCarouselProps {
  items: PostMediaItem[];
  /** feed = cropped cover + scroll autoplay; detail = full media within viewport */
  mode?: "feed" | "detail";
  className?: string;
}

interface MediaSlideProps {
  item: PostMediaItem;
  mode: "feed" | "detail";
  autoplayEnabled: boolean;
  isActiveSlide: boolean;
}

function stopClick(e: MouseEvent) {
  e.stopPropagation();
}

function VideoSlide({ item, mode, autoplayEnabled, isActiveSlide }: MediaSlideProps) {
  const { t } = useTranslation();
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const isDetail = mode === "detail";
  const shouldAutoplay = autoplayEnabled || isDetail;

  if (item.type !== "video") return null;

  const playbackUrl = pickVideoPlaybackUrl(item, mode);
  const posterKey = item.video?.poster_key;
  const isFailed = item.video?.status === "failed";
  const showPosterOnly = !playbackUrl && Boolean(posterKey);
  const hasProcessedVariants = Boolean(
    item.video?.url_480p || item.video?.url_720p || item.video?.url_1080p,
  );
  const isProcessing =
    (item.video?.status === "uploaded" || item.video?.status === "processing") &&
    !hasProcessedVariants &&
    showPosterOnly;

  useFeedVideoAutoplay(id, containerRef, videoRef, shouldAutoplay && Boolean(playbackUrl), isActiveSlide);

  return (
    <div
      ref={containerRef}
      className={cn("relative bg-black", isDetail ? "min-h-[200px]" : "aspect-[4/3]")}
    >
      {showPosterOnly && posterKey ? (
        <img
          src={mediaUrl(posterKey)}
          alt=""
          className={cn(
            "w-full h-full",
            isDetail ? "max-h-[75vh] object-contain mx-auto" : "object-cover",
          )}
        />
      ) : playbackUrl ? (
        <video
          ref={videoRef}
          src={mediaUrl(playbackUrl)}
          poster={posterKey ? mediaUrl(posterKey) : undefined}
          className={cn(
            "w-full h-full",
            isDetail ? "max-h-[75vh] object-contain mx-auto" : "object-cover",
          )}
          muted={muted}
          playsInline
          loop
          preload="metadata"
          onClick={stopClick}
        />
      ) : null}

      {isProcessing && !isFailed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-xs font-medium">{t("videoProcessing")}</span>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center text-sm text-white">
          {t("videoProcessingFailed")}
        </div>
      )}

      {playbackUrl && (
        <button
          type="button"
          onClick={(e) => {
            stopClick(e);
            setMuted((value) => !value);
          }}
          className="absolute bottom-3 end-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
          aria-label={muted ? t("unmuteVideo") : t("muteVideo")}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function ImageSlide({ item, mode }: Pick<MediaSlideProps, "item" | "mode">) {
  const isDetail = mode === "detail";
  if (item.type !== "image") return null;
  const src = pickImageUrl(item, mode);

  return (
    <img
      src={mediaUrl(src)}
      alt=""
      className={cn(
        "w-full",
        isDetail ? "max-h-[75vh] object-contain mx-auto" : "aspect-[4/3] object-cover",
      )}
      loading="lazy"
    />
  );
}

export default function PostMediaCarousel({
  items,
  mode = "feed",
  className,
}: PostMediaCarouselProps) {
  const [idx, setIdx] = useState(0);
  if (!items.length) return null;

  const isDetail = mode === "detail";
  const activeItem = items[idx];

  return (
    <div className={cn("relative bg-asphalt", className)}>
      {activeItem.type === "video" ? (
        <VideoSlide
          key={`video-${idx}-${activeItem.url}`}
          item={activeItem}
          mode={mode}
          autoplayEnabled={!isDetail}
          isActiveSlide
        />
      ) : (
        <ImageSlide key={`image-${idx}-${activeItem.url}`} item={activeItem} mode={mode} />
      )}

      {items.length > 1 && (
        <>
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {items.map((item, i) => (
              <span
                key={`${item.type}-${item.url}-${i}`}
                className={cn(
                  "rounded-full",
                  item.type === "video" ? "h-1.5 w-2.5" : "h-1.5 w-1.5",
                  i === idx ? "bg-white" : "bg-white/40",
                )}
              />
            ))}
          </div>
          {idx > 0 && (
            <button
              type="button"
              onClick={(e) => {
                stopClick(e);
                setIdx(idx - 1);
              }}
              className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white"
              aria-label="Previous"
            >
              ‹
            </button>
          )}
          {idx < items.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                stopClick(e);
                setIdx(idx + 1);
              }}
              className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white"
              aria-label="Next"
            >
              ›
            </button>
          )}
        </>
      )}
    </div>
  );
}
