import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import {
  SUPPORTED_VIDEO_TYPES,
  validateFileBeforeUpload,
} from "@/lib/mediaUpload";
import {
  captureVideoPoster,
  getVideoDuration,
  MAX_POST_VIDEO_DURATION_SEC,
} from "@/lib/videoPoster";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  initialVehicleId?: string;
}

type PostMediaDraft =
  | { kind: "image"; reference: string }
  | { kind: "video"; reference: string; poster?: string };

export default function CreatePostModal({ open, onClose, initialVehicleId }: CreatePostModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [media, setMedia] = useState<PostMediaDraft[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [uploadingVideo, setUploadingVideo] = useState(false);

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

  const handleVideoSelect = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    try {
      validateFileBeforeUpload(file);
      const duration = await getVideoDuration(file);
      if (duration > MAX_POST_VIDEO_DURATION_SEC) {
        toast.error(t("videoTooLong", { seconds: MAX_POST_VIDEO_DURATION_SEC }));
        return;
      }

      setUploadingVideo(true);
      let poster: string | undefined;
      try {
        poster = await captureVideoPoster(file);
      } catch {
        poster = undefined;
      }

      const result = await api.uploadMedia(file, "post");
      if (result.mediaType !== "video") {
        toast.error(t("error"));
        return;
      }

      setMedia((prev) => [...prev, { kind: "video", reference: result.reference, poster }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
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
      toast.success(t("publish"));
      setContent("");
      setLocation("");
      setMedia([]);
      setVehicleId("");
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
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t("createPost")}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t("whatsNew")}
            rows={4}
            className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          {media.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {media.map((item, i) => (
                <div key={`${item.kind}-${item.reference}-${i}`} className="relative shrink-0">
                  {item.kind === "image" ? (
                    <img src={mediaUrl(item.reference)} alt="" className="w-20 h-20 object-cover rounded-xl" />
                  ) : (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black">
                      {item.poster ? (
                        <img src={item.poster} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-white/80">
                          <Video className="h-6 w-6" />
                        </div>
                      )}
                      <span className="absolute bottom-1 start-1 rounded bg-black/60 px-1 text-[10px] text-white">
                        {t("video")}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setMedia(media.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-white text-xs flex items-center justify-center"
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
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted/50 text-sm"
            >
              <ImagePlus className="w-4 h-4 text-primary" />
              {imageUpload.uploading ? "..." : t("image")}
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted/50 text-sm"
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
              accept={SUPPORTED_VIDEO_TYPES.join(",")}
              className="hidden"
              onChange={(e) => void handleVideoSelect(e.target.files)}
            />
          </div>

          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t("locationPlaceholder")}
            className="h-10"
          />

          {vehicles.length > 0 && (
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full h-10 bg-muted/30 border border-border rounded-xl px-3 text-sm"
            >
              <option value="">{t("garage.linkVehicle")}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.year ? `${v.year} ` : ""}{v.make} {v.model}
                </option>
              ))}
            </select>
          )}

          <Button
            className="w-full"
            disabled={!canPublish}
            onClick={() => createPost.mutate()}
          >
            {t("publish")}
          </Button>
        </div>
      </div>
    </>
  );
}
