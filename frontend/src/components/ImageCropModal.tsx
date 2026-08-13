import Cropper, { Area } from "react-easy-crop";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { cropImageToFile } from "@/lib/cropImage";
import { CROP_PRESETS } from "@/lib/cropPresets";
import type { MediaPurpose } from "@/lib/mediaUpload";

interface ImageCropModalProps {
  file: File;
  purpose: MediaPurpose;
  queueRemaining?: number;
  uploading?: boolean;
  onConfirm: (cropped: File) => void;
  onCancel: () => void;
}

export default function ImageCropModal({
  file,
  purpose,
  queueRemaining = 0,
  uploading = false,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const { t } = useTranslation();
  const preset = CROP_PRESETS[purpose];
  const [imageUrl, setImageUrl] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedArea(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea || !imageUrl) return;
    setProcessing(true);
    try {
      const cropped = await cropImageToFile(imageUrl, croppedArea, file.name);
      onConfirm(cropped);
    } catch {
      // parent handles upload errors
    } finally {
      setProcessing(false);
    }
  };

  const busy = processing || uploading;
  const totalRemaining = queueRemaining + 1;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="text-sm text-white/80 hover:text-white disabled:opacity-50"
        >
          {t("crop.cancel")}
        </button>
        <div className="text-center min-w-0 px-2">
          <p className="text-sm font-medium text-white truncate">{t(preset.titleKey)}</p>
          {totalRemaining > 1 && (
            <p className="text-xs text-white/60">
              {t("crop.queueProgress", { remaining: totalRemaining })}
            </p>
          )}
        </div>
        <Button
          size="sm"
          disabled={busy || !croppedArea}
          onClick={handleConfirm}
          className="shrink-0"
        >
          {busy ? "..." : queueRemaining > 0 ? t("crop.next") : t("crop.confirm")}
        </Button>
      </div>

      <div className="relative flex-1 min-h-0 bg-black">
        {imageUrl && (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={preset.aspect}
            cropShape={preset.cropShape}
            showGrid={preset.cropShape === "rect"}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            objectFit="contain"
          />
        )}
      </div>

      <div className="shrink-0 px-6 py-5 space-y-3 bg-black border-t border-white/10 pb-safe">
        <p className="text-xs text-center text-white/60">{t(preset.hintKey)}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/70 shrink-0 w-8">{t("crop.zoom")}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-primary h-1"
            aria-label={t("crop.zoom")}
          />
        </div>
      </div>
    </div>
  );
}
