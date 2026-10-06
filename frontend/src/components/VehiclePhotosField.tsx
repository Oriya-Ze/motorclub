import { AlertTriangle, Camera, ChevronLeft, ChevronRight, Crop, ImagePlus, Lightbulb, Loader2, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import PostImageAdjust from "@/components/PostImageAdjust";
import { api, type ImageMedia } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { MAX_IMAGE_BYTES, MediaUploadError, SUPPORTED_IMAGE_TYPES } from "@/lib/mediaUpload";
import { pickStoredImageUrl } from "@/lib/postMedia";
import { cn } from "@/lib/utils";

export const MAX_VEHICLE_PHOTOS = 12;
/** Photos narrower than this look soft as a cover on the vehicle page. */
const LOW_RES_WIDTH = 1000;

type Status = "uploading" | "ready" | "rejected" | "held" | "failed";

interface PhotoItem {
  id: string;
  status: Status;
  progress: number | null;
  reference?: string;
  /** Before the first crop, so the crop can be undone without another upload. */
  original?: { reference: string; file?: File; previewUrl?: string };
  file?: File;
  previewUrl?: string;
  error?: string;
  lowRes?: boolean;
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Vehicle photos: upload right away with a local preview, crop and reorder afterwards, first photo is the cover.
 * A photo the scan did not approve stays private, so it is shown here with the reason and never saved.
 */
export default function VehiclePhotosField({
  initialUrls,
  imageMedia,
  onChange,
  onBusyChange,
  disabled,
}: {
  initialUrls: string[];
  imageMedia?: ImageMedia[] | null;
  onChange: (urls: string[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PhotoItem[]>(() =>
    initialUrls.map((reference) => ({
      id: newId(),
      status: "ready",
      progress: null,
      reference,
      previewUrl: mediaUrl(pickStoredImageUrl(reference, imageMedia, "feed")),
    })),
  );
  const [dragging, setDragging] = useState(false);
  const [adjust, setAdjust] = useState<{ id: string; src: string; name: string } | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const objectUrls = useRef<string[]>([]);
  const callbacks = useRef({ onChange, onBusyChange });
  callbacks.current = { onChange, onBusyChange };
  const reported = useRef("");

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  // Tell the parent which photos will be saved (approved and uploaded, in order) and whether uploads are running.
  useEffect(() => {
    const ready = items.filter((item) => item.status === "ready" && item.reference).map((item) => item.reference as string);
    const busy = items.some((item) => item.status === "uploading");
    const signature = `${ready.join("|")}#${busy}`;
    if (signature === reported.current) return;
    reported.current = signature;
    callbacks.current.onChange(ready);
    callbacks.current.onBusyChange?.(busy);
  }, [items]);

  const localUrl = (file: Blob) => {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    return url;
  };

  const patch = (id: string, change: Partial<PhotoItem> | ((item: PhotoItem) => PhotoItem)) =>
    setItems((prev) => prev.map((item) => (item.id === id ? (typeof change === "function" ? change(item) : { ...item, ...change }) : item)));

  const checkResolution = (id: string, url: string) => {
    const probe = new Image();
    probe.onload = () => patch(id, { lowRes: probe.naturalWidth < LOW_RES_WIDTH });
    probe.src = url;
  };

  /** Uploads one file. A crop replaces the item's photo only when the cropped one is approved. */
  const upload = (id: string, file: File, mode: "new" | "crop") => {
    chainRef.current = chainRef.current.then(async () => {
      patch(id, { status: "uploading", progress: null, error: undefined });
      try {
        const result = await api.uploadMedia(file, "vehicle", (percent) => patch(id, { progress: percent }));
        const approved = !result.reference.includes("/private/");
        if (mode === "crop") {
          if (!approved) {
            patch(id, { status: "ready", progress: null });
            toast.error(t(result.decision === "rejected" ? "garage.editor.photoRejected" : "garage.editor.photoHeld"));
            return;
          }
          const previewUrl = localUrl(file);
          patch(id, (item) => ({
            ...item,
            status: "ready",
            progress: null,
            original: item.original ?? (item.reference ? { reference: item.reference, file: item.file, previewUrl: item.previewUrl } : undefined),
            reference: result.reference,
            file,
            previewUrl,
          }));
          checkResolution(id, previewUrl);
          return;
        }
        if (approved) patch(id, { status: "ready", progress: null, reference: result.reference });
        else if (result.decision === "rejected") patch(id, { status: "rejected", progress: null, error: t("garage.editor.photoRejected") });
        else patch(id, { status: "held", progress: null, error: t("garage.editor.photoHeld") });
      } catch (err) {
        const message = err instanceof MediaUploadError ? err.message : t("garage.editor.photoFailed");
        if (mode === "crop") {
          patch(id, { status: "ready", progress: null });
          toast.error(message);
        } else {
          patch(id, { status: "failed", progress: null, error: message });
        }
      }
    });
  };

  const addFiles = (list: FileList | File[] | null) => {
    if (!list || disabled) return;
    let room = MAX_VEHICLE_PHOTOS - items.length;
    const added: PhotoItem[] = [];
    for (const file of Array.from(list)) {
      if (room <= 0) {
        toast.error(t("garage.editor.tooMany", { count: MAX_VEHICLE_PHOTOS }));
        break;
      }
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
        toast.error(t("garage.editor.photoType", { name: file.name }));
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(t("composer.imageTooLarge", { mb: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)) }));
        continue;
      }
      const item: PhotoItem = { id: newId(), status: "uploading", progress: null, file, previewUrl: localUrl(file) };
      added.push(item);
      room -= 1;
    }
    if (!added.length) return;
    setItems((prev) => [...prev, ...added]);
    for (const item of added) {
      checkResolution(item.id, item.previewUrl as string);
      upload(item.id, item.file as File, "new");
    }
  };

  const move = (index: number, to: number) =>
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      return next;
    });

  const remove = (id: string) => {
    if (adjust?.id === id) setAdjust(null);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const openCrop = async (item: PhotoItem) => {
    let source = item.original?.file ?? item.file;
    if (!source && (item.original?.reference || item.reference)) {
      try {
        const response = await fetch(mediaUrl(item.original?.reference || (item.reference as string)));
        if (!response.ok) throw new Error("fetch failed");
        const blob = await response.blob();
        source = new File([blob], "vehicle.jpg", { type: blob.type || "image/jpeg" });
      } catch {
        toast.error(t("composer.cropNeedsFile"));
        return;
      }
    }
    if (!source) return;
    setAdjust({ id: item.id, src: localUrl(source), name: source.name || "vehicle.jpg" });
  };

  const undoCrop = (id: string) => {
    patch(id, (item) =>
      item.original
        ? { ...item, reference: item.original.reference, file: item.original.file, previewUrl: item.original.previewUrl, original: undefined }
        : item,
    );
    setAdjust(null);
  };

  const adjusting = adjust ? items.find((item) => item.id === adjust.id) : undefined;
  const iconButton = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:opacity-30 sm:h-8 sm:w-8";

  return (
    <div
      className={cn("space-y-3 rounded-2xl transition-shadow", dragging && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {items.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/20 px-4 py-10 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-glow">
            <Camera className="h-7 w-7" aria-hidden />
          </span>
          <span className="text-base font-semibold">{t("garage.editor.dropTitle")}</span>
          <span className="max-w-sm text-sm text-muted-foreground">{t("garage.editor.dropHint")}</span>
          <span className="text-xs text-muted-foreground">{t("garage.editor.photoRules", { mb: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)) })}</span>
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.id} className="relative aspect-video overflow-hidden rounded-xl border border-border bg-muted">
              {item.previewUrl ? (
                <img src={item.previewUrl} alt={t("garage.photoIndex", { n: index + 1, total: items.length })} className="h-full w-full object-cover" />
              ) : null}

              {item.status === "ready" && (index === 0 || item.lowRes) ? (
                <div className="absolute start-1.5 top-1.5 flex flex-col items-start gap-1">
                  {index === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      <Star className="h-3 w-3 fill-current" aria-hidden />
                      {t("garage.editor.cover")}
                    </span>
                  ) : null}
                  {item.lowRes ? (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-black">{t("garage.editor.lowRes")}</span>
                  ) : null}
                </div>
              ) : null}
              {item.status === "ready" ? (
                <button type="button" className={cn(iconButton, "absolute end-1.5 top-1.5")} disabled={disabled} onClick={() => remove(item.id)} aria-label={t("garage.removePhoto")} title={t("garage.removePhoto")}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}

              {item.status === "uploading" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-xs text-white" role="status">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  {item.progress == null || item.progress >= 100 ? t("garage.editor.checking") : t("garage.editor.uploadingPercent", { percent: item.progress })}
                </div>
              ) : null}

              {item.status === "rejected" || item.status === "held" || item.status === "failed" ? (
                <div className="absolute inset-0 flex flex-col justify-between gap-1 bg-black/75 p-2 text-white" role="alert">
                  <p className="flex items-start gap-1.5 text-[11px] leading-snug">
                    <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", item.status === "rejected" ? "text-red-400" : "text-amber-300")} aria-hidden />
                    {item.error}
                  </p>
                  <div className="flex gap-1.5">
                    {item.status !== "rejected" && item.file ? (
                      <button type="button" className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium hover:bg-white/25" onClick={() => upload(item.id, item.file as File, "new")}>
                        {t("garage.editor.retry")}
                      </button>
                    ) : null}
                    <button type="button" className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium hover:bg-white/25" onClick={() => remove(item.id)}>
                      {t("garage.removePhoto")}
                    </button>
                  </div>
                </div>
              ) : null}

              {item.status === "ready" ? (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-1 pt-6 sm:p-1.5">
                  <div className="flex gap-1">
                    {index > 0 ? (
                      <button type="button" className={iconButton} disabled={disabled} onClick={() => move(index, 0)} aria-label={t("garage.editor.makeCover")} title={t("garage.editor.makeCover")}>
                        <Star className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                    <button type="button" className={iconButton} disabled={disabled} onClick={() => void openCrop(item)} aria-label={t("garage.editor.crop")} title={t("garage.editor.crop")}>
                      <Crop className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" className={iconButton} disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={t("garage.movePhotoEarlier")} title={t("garage.movePhotoEarlier")}>
                      <ChevronRight className="h-4 w-4 ltr:rotate-180" aria-hidden />
                    </button>
                    <button type="button" className={iconButton} disabled={disabled || index === items.length - 1} onClick={() => move(index, index + 1)} aria-label={t("garage.movePhotoLater")} title={t("garage.movePhotoLater")}>
                      <ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden />
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
          {items.length < MAX_VEHICLE_PHOTOS ? (
            <li>
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="flex aspect-video w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ImagePlus className="h-5 w-5 text-primary" aria-hidden />
                {t("garage.editor.addMore")}
                <span className="text-[11px]">{t("garage.editor.photoCount", { count: items.length, max: MAX_VEHICLE_PHOTOS })}</span>
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {adjust && adjusting ? (
        <div className="space-y-2">
          <PostImageAdjust
            src={adjust.src}
            fileName={adjust.name}
            initialAspect={16 / 9}
            canReset={Boolean(adjusting.original)}
            busy={adjusting.status === "uploading"}
            onCancel={() => setAdjust(null)}
            onReset={() => undoCrop(adjust.id)}
            onSourceError={() => {
              toast.error(t("composer.cropNeedsFile"));
              setAdjust(null);
            }}
            onApply={(file) => {
              upload(adjust.id, file, "crop");
              setAdjust(null);
            }}
          />
        </div>
      ) : null}

      {items.length > 0 ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {t("garage.editor.tip")}
        </p>
      ) : null}
    </div>
  );
}
