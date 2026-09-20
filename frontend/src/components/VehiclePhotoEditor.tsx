import { ChevronLeft, ChevronRight, Star, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { mediaUrl } from "@/lib/media";
import { pickStoredImageUrl } from "@/lib/postMedia";
import { cn } from "@/lib/utils";
import type { ImageMedia } from "@/lib/api";

type Props = {
  urls: string[];
  imageMedia?: ImageMedia[] | null;
  onChange: (urls: string[]) => void;
  disabled?: boolean;
};

export default function VehiclePhotoEditor({ urls, imageMedia, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const upload = useImageCropUpload({
    purpose: "vehicle",
    multiple: true,
    onUploaded: (result) => onChange([...urls, result.reference]),
  });

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= urls.length) return;
    const copy = [...urls];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      {upload.cropModal}
      <input
        ref={upload.inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => upload.handleSelect(e.target.files)}
        disabled={disabled || upload.uploading}
      />
      {urls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {urls.map((url, i) => (
            <div key={`${url}-${i}`} className="relative shrink-0">
              <img
                src={mediaUrl(pickStoredImageUrl(url, imageMedia, "feed"))}
                alt={t("garage.photoIndex", { n: i + 1, total: urls.length })}
                className="w-20 h-20 object-cover rounded-lg"
              />
              {i === 0 && (
                <span className="absolute bottom-1 start-1 inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  {t("garage.coverPhoto")}
                </span>
              )}
              <div className="absolute top-1 end-1 flex gap-0.5">
                <button
                  type="button"
                  className="w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center disabled:opacity-30"
                  onClick={() => move(i, -1)}
                  disabled={disabled || i === 0}
                  aria-label={t("garage.movePhotoEarlier")}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center disabled:opacity-30"
                  onClick={() => move(i, 1)}
                  disabled={disabled || i === urls.length - 1}
                  aria-label={t("garage.movePhotoLater")}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  className="w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center"
                  onClick={() => onChange(urls.filter((_, j) => j !== i))}
                  disabled={disabled}
                  aria-label={t("garage.removePhoto")}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => upload.openPicker()}
        disabled={disabled || upload.uploading}
        className={cn(
          "inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-border hover:bg-muted/50",
          (disabled || upload.uploading) && "opacity-50"
        )}
      >
        <Upload className="w-4 h-4" />
        {upload.uploading ? t("garage.uploadingPhotos") : t("garage.addPhotos")}
      </button>
    </div>
  );
}
