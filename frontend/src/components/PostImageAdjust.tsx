import Cropper, { Area } from "react-easy-crop";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { cropImageToFile } from "@/lib/cropImage";
import { cn } from "@/lib/utils";

const ASPECTS = [
  { id: "1:1", value: 1 },
  { id: "4:5", value: 4 / 5 },
  { id: "4:3", value: 4 / 3 },
  { id: "16:9", value: 16 / 9 },
] as const;

interface PostImageAdjustProps {
  src: string;
  fileName: string;
  canReset: boolean;
  busy?: boolean;
  /** The ratio the crop starts at; 4:3 unless given. */
  initialAspect?: (typeof ASPECTS)[number]["value"];
  onCancel: () => void;
  onReset: () => void;
  onApply: (file: File) => void;
  onSourceError: () => void;
}

export default function PostImageAdjust({
  src,
  fileName,
  canReset,
  busy = false,
  initialAspect = 4 / 3,
  onCancel,
  onReset,
  onApply,
  onSourceError,
}: PostImageAdjustProps) {
  const { t } = useTranslation();
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]["value"]>(initialAspect);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);
  const onSourceErrorRef = useRef(onSourceError);
  onSourceErrorRef.current = onSourceError;

  useEffect(() => {
    const image = new Image();
    if (src.startsWith("http")) image.crossOrigin = "anonymous";
    image.onerror = () => onSourceErrorRef.current();
    image.src = src;
  }, [src]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setArea(pixels);
  }, []);

  const apply = async () => {
    if (!area) return;
    setWorking(true);
    try {
      const file = await cropImageToFile(src, area, fileName);
      onApply(file);
    } catch {
      onSourceError();
    } finally {
      setWorking(false);
    }
  };

  const locked = busy || working;

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t("composer.cropTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("composer.cropOptional")}</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("composer.cropRatio")}>
        {ASPECTS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={aspect === option.value}
            onClick={() => {
              setAspect(option.value);
              setCrop({ x: 0, y: 0 });
              setZoom(1);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              aspect === option.value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {option.id}
          </button>
        ))}
      </div>
      <div className="relative h-64 overflow-hidden rounded-xl bg-black">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          objectFit="contain"
        />
      </div>
      <label className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="shrink-0">{t("crop.zoom")}</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="flex-1 accent-primary"
          aria-label={t("crop.zoom")}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={locked}>
          {t("composer.cropCancel")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={locked || !canReset}>
          {t("composer.cropReset")}
        </Button>
        <Button type="button" size="sm" className="!shadow-none" onClick={() => void apply()} disabled={locked || !area}>
          {locked ? t("composer.cropApplying") : t("composer.cropApply")}
        </Button>
      </div>
    </div>
  );
}
