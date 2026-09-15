import { Expand, Loader2, Volume2, VolumeX } from "lucide-react";
import { useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import MediaLightbox, { type FullMediaItem } from "@/components/MediaLightbox";
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
  onOpenFull: () => void;
}

function stopClick(e: MouseEvent) {
  e.stopPropagation();
}

function toLightboxItems(items: PostMediaItem[]): FullMediaItem[] {
  return items.map((item) => {
    if (item.type === "video") {
      const src = pickVideoPlaybackUrl(item, "detail");
      const poster = item.video?.poster_key ? mediaUrl(item.video.poster_key) : undefined;
      return { kind: "video" as const, src: mediaUrl(src || item.url), poster };
    }
    return { kind: "image" as const, src: mediaUrl(pickImageUrl(item, "detail")) };
  });
}

function VideoSlide({ item, mode, autoplayEnabled, isActiveSlide, onOpenFull }: MediaSlideProps) {
  const { t } = useTranslation();
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const isDetail = mode === "detail";
  const shouldAutoplay = autoplayEnabled || isDetail;
  const videoItem = item.type === "video" ? item : null;
  const playbackUrl = videoItem ? pickVideoPlaybackUrl(videoItem, mode) : null;
  const posterKey = videoItem?.video?.poster_key;
  const isFailed = videoItem?.video?.status === "failed";
  const showPosterOnly = !playbackUrl && Boolean(posterKey);
  const hasProcessedVariants = Boolean(
    videoItem?.video?.url_480p || videoItem?.video?.url_720p || videoItem?.video?.url_1080p,
  );
  const isProcessing =
    (videoItem?.video?.status === "uploaded" || videoItem?.video?.status === "processing") &&
    !hasProcessedVariants &&
    showPosterOnly;

  useFeedVideoAutoplay(id, containerRef, videoRef, shouldAutoplay && Boolean(playbackUrl), isActiveSlide);

  if (!videoItem) return null;

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

      {isDetail && (
        <button
          type="button"
          className="absolute inset-0 z-[5]"
          onClick={(e) => {
            stopClick(e);
            videoRef.current?.pause();
            onOpenFull();
          }}
          aria-label={t("viewFullMedia")}
        />
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

function ImageSlide({ item, mode, onOpenFull }: Pick<MediaSlideProps, "item" | "mode" | "onOpenFull">) {
  const { t } = useTranslation();
  const isDetail = mode === "detail";
  if (item.type !== "image") return null;
  const src = pickImageUrl(item, mode);
  const img = (
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

  if (!isDetail) return img;

  return (
    <button
      type="button"
      className="block w-full"
      onClick={(e) => {
        stopClick(e);
        onOpenFull();
      }}
      aria-label={t("viewFullMedia")}
    >
      {img}
    </button>
  );
}

export default function PostMediaCarousel({
  items,
  mode = "feed",
  className,
}: PostMediaCarouselProps) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const lightboxItems = useMemo(() => toLightboxItems(items), [items]);
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
          autoplayEnabled={!isDetail && !lightbox}
          isActiveSlide={!lightbox}
          onOpenFull={() => setLightbox(true)}
        />
      ) : (
        <ImageSlide
          key={`image-${idx}-${activeItem.url}`}
          item={activeItem}
          mode={mode}
          onOpenFull={() => setLightbox(true)}
        />
      )}

      {isDetail && (
        <button
          type="button"
          onClick={(e) => {
            stopClick(e);
            setLightbox(true);
          }}
          className="absolute top-3 start-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
          aria-label={t("viewFullMedia")}
        >
          <Expand className="h-4 w-4" />
        </button>
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
              aria-label={t("prevMedia")}
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
              aria-label={t("nextMedia")}
            >
              ›
            </button>
          )}
        </>
      )}

      <MediaLightbox
        open={lightbox}
        items={lightboxItems}
        index={idx}
        onClose={() => setLightbox(false)}
        onIndexChange={(next) => setIdx(Math.max(0, Math.min(items.length - 1, next)))}
      />
    </div>
  );
}
