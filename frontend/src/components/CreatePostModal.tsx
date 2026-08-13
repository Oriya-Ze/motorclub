import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  initialVehicleId?: string;
}

export default function CreatePostModal({ open, onClose, initialVehicleId }: CreatePostModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");

  const imageUpload = useImageCropUpload({
    purpose: "post",
    multiple: true,
    onUploaded: (result) => setImages((prev) => [...prev, result.reference]),
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

  const createPost = useMutation({
    mutationFn: () =>
      api.createPost({
        content: content || undefined,
        image_urls: images.length ? images : undefined,
        location: location || undefined,
        vehicle_id: vehicleId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(t("publish"));
      setContent("");
      setLocation("");
      setImages([]);
      setVehicleId("");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

          {images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((url, i) => (
                <div key={i} className="relative shrink-0">
                  <img src={mediaUrl(url)} alt="" className="w-20 h-20 object-cover rounded-xl" />
                  <button
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
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
              disabled={imageUpload.uploading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted/50 text-sm"
            >
              <ImagePlus className="w-4 h-4 text-primary" />
              {imageUpload.uploading ? "..." : t("image")}
            </button>
            <input
              ref={imageUpload.inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => imageUpload.handleSelect(e.target.files)}
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
            disabled={(!content.trim() && !images.length) || createPost.isPending || imageUpload.uploading}
            onClick={() => createPost.mutate()}
          >
            {t("publish")}
          </Button>
        </div>
      </div>
    </>
  );
}
