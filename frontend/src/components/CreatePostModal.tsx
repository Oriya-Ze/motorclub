import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { pickStoredImageUrl } from "@/lib/postMedia";
import {
  MAX_VIDEO_BYTES,
  MediaUploadError,
  SUPPORTED_VIDEO_TYPES,
  validateFileBeforeUpload,
} from "@/lib/mediaUpload";
import {
  createVideoPreviewUrl,
  getVideoDuration,
  MAX_POST_VIDEO_DURATION_SEC,
} from "@/lib/videoPoster";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  initialVehicleId?: string;
  onPublished?: () => void;
}

type PostMediaDraft =
  | { kind: "image"; reference: string }
  | { kind: "video"; reference: string; localPreview?: string };

function formatVideoUploadError(err: unknown, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (err instanceof MediaUploadError) {
    if (err.code === "video_too_large") {
      return t("videoTooLargeMB", { mb: Math.round(MAX_VIDEO_BYTES / (1024 * 1024)) });
    }
    if (err.code === "s3_put_failed") {
      return t("videoUploadFailed");
    }
    return err.message;
  }
  if (err instanceof Error) {
    if (err.message === "duration_timeout") return t("videoDurationUnknown");
    if (err.message === "invalid_video") return t("videoInvalid");
  }
  return t("error");
}

export default function CreatePostModal({ open, onClose, initialVehicleId, onPublished }: CreatePostModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [media, setMedia] = useState<PostMediaDraft[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadLabel, setVideoUploadLabel] = useState<string | null>(null);

  const imageUpload = useImageCropUpload({
    purpose: "post",
    multiple: true,
    onUploaded: (result) => setMedia((prev) => [...prev, { kind: "image", reference: result.reference }]),
    onError: (err) => toast.error(err.message),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["garage"],
    queryFn: () => api.getMyGarage(),
    enabled: open,
  });

  useEffect(() => {
    if (open && initialVehicleId) setVehicleId(initialVehicleId);
  }, [open, initialVehicleId]);

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
      previewUrlsRef.current = [];
    };
  }, []);

  const revokePreview = (url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current = previewUrlsRef.current.filter((item) => item !== url);
  };

  const handleClose = () => {
    if (uploadingVideo || imageUpload.uploading) return;
    onClose();
  };

  const handleVideoSelect = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    try {
      validateFileBeforeUpload(file);

      try {
        const duration = await getVideoDuration(file);
        if (Number.isFinite(duration) && duration > MAX_POST_VIDEO_DURATION_SEC) {
          toast.error(t("videoTooLong", { seconds: MAX_POST_VIDEO_DURATION_SEC }));
          return;
        }
      } catch (err) {
        if (!(err instanceof Error && err.message === "duration_timeout")) {
          throw err;
        }
      }

      setUploadingVideo(true);
      setVideoUploadLabel(t("videoUploading"));

      const result = await api.uploadMedia(file, "post");
      if (result.mediaType !== "video") {
        toast.error(t("error"));
        return;
      }

      const localPreview = createVideoPreviewUrl(file);
      previewUrlsRef.current.push(localPreview);

      setMedia((prev) => [
        ...prev,
        { kind: "video", reference: result.reference, localPreview },
      ]);
      toast.success(t("videoUploadDone"));
    } catch (err) {
      toast.error(formatVideoUploadError(err, t));
    } finally {
      setUploadingVideo(false);
      setVideoUploadLabel(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const removeMedia = (index: number) => {
    const item = media[index];
    if (item?.kind === "video") revokePreview(item.localPreview);
    setMedia(media.filter((_, j) => j !== index));
  };

  const createPost = useMutation({
    mutationFn: () => {
      const image_urls = media.filter((item) => item.kind === "image").map((item) => item.reference);
      const video_urls = media.filter((item) => item.kind === "video").map((item) => item.reference);

      return api.createPost({
        content: content || undefined,
        image_urls: image_urls.length ? image_urls : undefined,
        video_urls: video_urls.length ? video_urls : undefined,
        location: location || undefined,
        vehicle_id: vehicleId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-posts"] });
      toast.success(t("publish"));
      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
      previewUrlsRef.current = [];
      setContent("");
      setLocation("");
      setMedia([]);
      setVehicleId("");
      onPublished?.();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isUploading = imageUpload.uploading || uploadingVideo;
  const canPublish = (content.trim().length > 0 || media.length > 0) && !isUploading && !createPost.isPending;

  if (!open) return null;

  return (
    <>
      {imageUpload.cropModal}
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />
        <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("createPost")}</h2>
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {videoUploadLabel && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>{videoUploadLabel}</span>
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("whatsNew")}
            rows={4}
            disabled={isUploading}
            className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
          />

          {media.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {media.map((item, i) => (
                <div key={`${item.kind}-${item.reference}-${i}`} className="relative shrink-0">
                  {item.kind === "image" ? (
                    <img src={mediaUrl(item.reference)} alt="" className="w-20 h-20 object-cover rounded-xl" />
                  ) : (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black">
                      {item.localPreview ? (
                        <video
                          src={item.localPreview}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <video
                          src={mediaUrl(item.reference)}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      )}
                      <span className="absolute bottom-1 start-1 rounded bg-black/60 px-1 text-[10px] text-white">
                        {t("video")}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => removeMedia(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-white text-xs flex items-center justify-center disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={imageUpload.openPicker}
              disabled={isUploading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted/50 text-sm disabled:opacity-50"
            >
              <ImagePlus className="w-4 h-4 text-primary" />
              {imageUpload.uploading ? "..." : t("image")}
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted/50 text-sm disabled:opacity-50"
            >
              <Video className="w-4 h-4 text-primary" />
              {uploadingVideo ? "..." : t("video")}
            </button>
            <input
              ref={imageUpload.inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => imageUpload.handleSelect(e.target.files)}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept={`${SUPPORTED_VIDEO_TYPES.join(",")},video/*`}
              className="hidden"
              onChange={(e) => void handleVideoSelect(e.target.files)}
            />
          </div>

          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            className="h-10"
            disabled={isUploading}
          />

          {vehicles.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("garage.linkVehicle")}</p>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                <button
                  type="button"
                  onClick={() => setVehicleId("")}
                  className={`shrink-0 px-3 py-2 rounded-xl border text-sm ${
                    !vehicleId ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  {t("garage.noVehicle")}
                </button>
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVehicleId(v.id)}
                    className={`shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-xl border text-sm ${
                      vehicleId === v.id ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    {v.image_urls?.[0] ? (
                      <img src={mediaUrl(pickStoredImageUrl(v.image_urls[0], v.image_media, "feed"))} alt="" className="w-8 h-8 rounded-md object-cover" />
                    ) : (
                      <span className="w-8 h-8 rounded-md bg-muted inline-flex items-center justify-center text-[10px]">
                        {v.make.slice(0, 1)}
                      </span>
                    )}
                    <span className="whitespace-nowrap">
                      {v.year ? `${v.year} ` : ""}
                      {v.make} {v.model}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Link
              to="/profile?tab=garage"
              onClick={onClose}
              className="text-sm text-primary hover:underline text-start"
            >
              {t("garage.addToPostCta")}
            </Link>
          )}

          <Button
            className="w-full"
            disabled={!canPublish}
            onClick={() => createPost.mutate()}
          >
            {createPost.isPending ? "..." : t("publish")}
          </Button>
        </div>
      </div>
    </>
  );
}
