import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ImagePlus, MapPin, Replace, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import MediaLightbox from "@/components/MediaLightbox";
import PostImageAdjust from "@/components/PostImageAdjust";
import PostMediaCarousel from "@/components/PostMediaCarousel";
import VehicleBadge from "@/components/VehicleBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, Vehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import {
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MediaUploadError,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_VIDEO_TYPES,
  inferMediaType,
  validateFileBeforeUpload,
} from "@/lib/mediaUpload";
import { pickStoredImageUrl, type PostMediaItem } from "@/lib/postMedia";
import {
  clearPostDraft,
  loadPostDraft,
  savePostDraft,
  type DraftMedia,
  type PostStarter,
} from "@/lib/postDraft";
import { createVideoPreviewUrl, getVideoDuration, MAX_POST_VIDEO_DURATION_SEC } from "@/lib/videoPoster";
import { cn, displayName, formatHandle } from "@/lib/utils";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  initialVehicleId?: string;
  onPublished?: () => void;
}

type MediaStatus = "pending" | "uploading" | "ready" | "failed";

interface ComposerMedia {
  id: string;
  kind: "image" | "video";
  name: string;
  status: MediaStatus;
  progress: number | null;
  reference?: string;
  originalReference?: string;
  error?: string;
  file?: File;
  previewUrl?: string;
}

const STARTERS: { id: Exclude<PostStarter, "">; label: string; placeholder: string }[] = [
  { id: "update", label: "composer.starterUpdate", placeholder: "composer.placeholderUpdate" },
  { id: "mod", label: "composer.starterMod", placeholder: "composer.placeholderMod" },
  { id: "service", label: "composer.starterService", placeholder: "composer.placeholderService" },
  { id: "question", label: "composer.starterQuestion", placeholder: "composer.placeholderQuestion" },
];

const ACCEPT = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES].join(",");

function feedOrder(items: ComposerMedia[]): ComposerMedia[] {
  return [...items.filter((item) => item.kind === "image"), ...items.filter((item) => item.kind === "video")];
}

function vehicleLabel(vehicle: Vehicle): string {
  return vehicle.nickname?.trim() || [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

function fileError(
  err: unknown,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (err instanceof MediaUploadError) {
    if (err.code === "unsupported_type") return t("composer.unsupported");
    if (err.code === "file_too_large") return t("composer.imageTooLarge", { mb: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)) });
    if (err.code === "video_too_large") return t("videoTooLargeMB", { mb: Math.round(MAX_VIDEO_BYTES / (1024 * 1024)) });
    if (err.code === "empty_file") return t("composer.emptyFile");
    return t("composer.uploadFailed");
  }
  if (err instanceof Error && err.message === "invalid_video") return t("videoInvalid");
  if (err instanceof Error && err.message === "duration_timeout") return t("videoInvalid");
  return t("composer.uploadFailed");
}

function toDraftMedia(item: ComposerMedia, interrupted: string): DraftMedia {
  if (item.status === "ready" && item.reference) {
    return {
      id: item.id,
      kind: item.kind,
      name: item.name,
      status: "ready",
      reference: item.reference,
      originalReference: item.originalReference || item.reference,
    };
  }
  if (item.reference) {
    return {
      id: item.id,
      kind: item.kind,
      name: item.name,
      status: "ready",
      reference: item.reference,
      originalReference: item.originalReference || item.reference,
    };
  }
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    status: "failed",
    error: item.error || interrupted,
  };
}

export default function CreatePostModal({ open, onClose, initialVehicleId, onPublished }: CreatePostModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIdRef = useRef<string | null>(null);
  const sessionRef = useRef(0);
  const chainRef = useRef(Promise.resolve());
  const previewUrlsRef = useRef<string[]>([]);
  const latestRef = useRef({
    content: "",
    location: "",
    vehicleId: "",
    starter: "" as PostStarter,
    media: [] as ComposerMedia[],
  });

  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [starter, setStarter] = useState<PostStarter>("");
  const [media, setMedia] = useState<ComposerMedia[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [dragOver, setDragOver] = useState(false);
  const [toolQuery, setToolQuery] = useState("");
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustSrc, setAdjustSrc] = useState<string | null>(null);
  const [cropBlocked, setCropBlocked] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const dragIdRef = useRef<string | null>(null);
  const leaveOpenRef = useRef(false);
  const publishingRef = useRef(false);
  leaveOpenRef.current = leaveOpen;

  const { data: vehicles = [] } = useQuery({
    queryKey: ["garage"],
    queryFn: () => api.getMyGarage(),
    enabled: open && Boolean(user),
  });

  latestRef.current = { content, location, vehicleId, starter, media };

  const revokePreview = (url?: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current = previewUrlsRef.current.filter((item) => item !== url);
  };

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    if (!open || !user) {
      setHydrated(false);
      return;
    }
    const draft = loadPostDraft(user.id);
    if (draft) {
      setContent(draft.content);
      setLocation(draft.location);
      setVehicleId(draft.vehicleId || initialVehicleId || "");
      setStarter(draft.starter);
      setMedia(draft.media.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        status: item.status === "ready" && item.reference ? "ready" : "failed",
        progress: null,
        reference: item.reference,
        originalReference: item.originalReference,
        error: item.status === "ready" && item.reference ? undefined : (item.error || t("composer.uploadInterrupted")),
      })));
    } else {
      setContent("");
      setLocation("");
      setVehicleId(initialVehicleId || "");
      setStarter("");
      setMedia([]);
    }
    setLeaveOpen(false);
    setMobileTab("edit");
    setAdjustId(null);
    setAdjustSrc(null);
    setCropBlocked(false);
    setHydrated(true);
    // Reload only when the editor opens for this member.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !hydrated || !user) return;
    setSaveState("saving");
    const handle = window.setTimeout(() => {
      const current = latestRef.current;
      const draftMedia = current.media.map((item) => toDraftMedia(item, t("composer.uploadInterrupted")));
      const empty = !current.content.trim() && !current.location.trim() && !current.vehicleId && !current.starter && draftMedia.length === 0;
      try {
        if (empty) clearPostDraft(user.id);
        else {
          savePostDraft(user.id, {
            content: current.content,
            location: current.location,
            vehicleId: current.vehicleId,
            starter: current.starter,
            media: draftMedia,
          });
        }
        setSaveState(empty ? "idle" : "saved");
      } catch {
        setSaveState("error");
      }
    }, 450);
    return () => window.clearTimeout(handle);
  }, [open, hydrated, user, content, location, vehicleId, starter, media, t]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = dialogRef.current;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (leaveOpenRef.current) {
          setLeaveOpen(false);
          return;
        }
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex='-1'])"));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    root?.querySelector<HTMLElement>("textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open]);

  const ordered = useMemo(() => feedOrder(media), [media]);
  const hasVideo = ordered.some((item) => item.kind === "video");
  const hasImage = ordered.some((item) => item.kind === "image");
  const readyItems = ordered.filter((item) => item.status === "ready" && item.reference);
  const previewMedia: PostMediaItem[] = [
    ...readyItems.filter((item) => item.kind === "image").map((item) => ({ type: "image" as const, url: item.reference! })),
    ...readyItems.filter((item) => item.kind === "video").map((item) => ({ type: "video" as const, url: item.reference! })),
  ];
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const filteredVehicles = vehicles.filter((vehicle) => {
    const query = toolQuery.trim().toLowerCase();
    if (!query) return true;
    return vehicleLabel(vehicle).toLowerCase().includes(query);
  });
  const placeholderKey = STARTERS.find((item) => item.id === starter)?.placeholder ?? "composer.placeholder";
  const blocked = media.some((item) => item.status !== "ready");

  function requestClose() {
    const current = latestRef.current;
    const dirty = current.content.trim() || current.location.trim() || current.vehicleId || current.starter || current.media.length > 0;
    if (!dirty) {
      if (user) clearPostDraft(user.id);
      onClose();
      return;
    }
    setLeaveOpen(true);
  }

  function persistAndClose() {
    if (!user) {
      onClose();
      return;
    }
    const current = latestRef.current;
    try {
      const draftMedia = current.media.map((item) => toDraftMedia(item, t("composer.uploadInterrupted")));
      const empty = !current.content.trim() && !current.location.trim() && !current.vehicleId && !current.starter && draftMedia.length === 0;
      if (empty) clearPostDraft(user.id);
      else {
        savePostDraft(user.id, {
          content: current.content,
          location: current.location,
          vehicleId: current.vehicleId,
          starter: current.starter,
          media: draftMedia,
        });
      }
    } catch {
      setSaveState("error");
      return;
    }
    sessionRef.current += 1;
    setLeaveOpen(false);
    onClose();
  }

  function discardAndClose() {
    sessionRef.current += 1;
    for (const item of media) revokePreview(item.previewUrl);
    if (user) clearPostDraft(user.id);
    setContent("");
    setLocation("");
    setVehicleId("");
    setStarter("");
    setMedia([]);
    setLeaveOpen(false);
    onClose();
  }

  async function uploadOne(id: string, file: File, session: number, replaceOriginal: boolean) {
    if (sessionRef.current !== session) return;
    setMedia((prev) => prev.map((item) => item.id === id ? { ...item, status: "uploading", progress: null, error: undefined } : item));
    try {
      const kind = validateFileBeforeUpload(file);
      if (kind === "video") {
        try {
          const duration = await getVideoDuration(file);
          if (Number.isFinite(duration) && duration > MAX_POST_VIDEO_DURATION_SEC) {
            throw new Error("too_long");
          }
        } catch (err) {
          if (err instanceof Error && err.message === "too_long") throw err;
          if (!(err instanceof Error && err.message === "duration_timeout")) throw err;
        }
      }
      if (sessionRef.current !== session) return;
      const result = await api.uploadMedia(file, "post", (percent) => {
        if (sessionRef.current !== session) return;
        setMedia((prev) => prev.map((item) => item.id === id ? { ...item, status: "uploading", progress: percent } : item));
      });
      if (sessionRef.current !== session) return;
      setMedia((prev) => prev.map((item) => {
        if (item.id !== id) return item;
        const original = replaceOriginal ? result.reference : (item.originalReference || result.reference);
        return {
          ...item,
          kind: result.mediaType,
          status: "ready",
          progress: 100,
          reference: result.reference,
          originalReference: original,
          error: undefined,
          file: replaceOriginal ? file : (item.file ?? file),
        };
      }));
    } catch (err) {
      if (sessionRef.current !== session) return;
      const message = err instanceof Error && err.message === "too_long"
        ? t("videoTooLong", { seconds: MAX_POST_VIDEO_DURATION_SEC })
        : fileError(err, t);
      setMedia((prev) => prev.map((item) => {
        if (item.id !== id) return item;
        if (item.reference) {
          return { ...item, status: "ready", progress: null, error: message };
        }
        return { ...item, status: "failed", progress: null, error: message };
      }));
    }
  }

  function enqueue(id: string, file: File, replaceOriginal: boolean) {
    const session = sessionRef.current;
    chainRef.current = chainRef.current
      .then(() => uploadOne(id, file, session, replaceOriginal))
      .catch(() => undefined);
  }

  function addFiles(list: FileList | File[], replaceId?: string) {
    const files = Array.from(list);
    if (!files.length) return;
    if (replaceId) {
      const file = files[0];
      let error: string | undefined;
      let kind: "image" | "video" = "image";
      try {
        kind = validateFileBeforeUpload(file);
      } catch (err) {
        error = fileError(err, t);
        try {
          kind = inferMediaType(file);
        } catch {
          kind = "image";
        }
      }
      const previous = media.find((item) => item.id === replaceId);
      if (previous?.previewUrl) revokePreview(previous.previewUrl);
      const previewUrl = !error && kind === "video" ? createVideoPreviewUrl(file) : undefined;
      if (previewUrl) previewUrlsRef.current.push(previewUrl);
      setMedia((prev) => feedOrder(prev.map((item) => {
        if (item.id !== replaceId) return item;
        if (error && item.reference) {
          return { ...item, error };
        }
        return {
          ...item,
          kind,
          name: file.name || item.name,
          status: error ? "failed" : "pending",
          progress: null,
          error,
          file: error ? item.file : file,
          previewUrl: previewUrl || item.previewUrl,
          reference: error ? item.reference : undefined,
          originalReference: error ? item.originalReference : undefined,
        };
      })));
      if (!error) enqueue(replaceId, file, true);
      return;
    }

    const nextItems: ComposerMedia[] = [];
    for (const file of files) {
      const id = crypto.randomUUID();
      let error: string | undefined;
      let kind: "image" | "video" = "image";
      try {
        kind = validateFileBeforeUpload(file);
      } catch (err) {
        error = fileError(err, t);
        try {
          kind = inferMediaType(file);
        } catch {
          kind = file.type.startsWith("video/") ? "video" : "image";
        }
      }
      const previewUrl = !error && kind === "video" ? createVideoPreviewUrl(file) : undefined;
      if (previewUrl) previewUrlsRef.current.push(previewUrl);
      nextItems.push({
        id,
        kind,
        name: file.name || (kind === "video" ? t("video") : t("image")),
        status: error ? "failed" : "pending",
        progress: null,
        error,
        file: error ? undefined : file,
        previewUrl,
      });
      if (!error) enqueue(id, file, true);
    }
    setMedia((prev) => feedOrder([...prev, ...nextItems]));
  }

  function removeMedia(id: string) {
    const item = media.find((entry) => entry.id === id);
    revokePreview(item?.previewUrl);
    if (adjustId === id) {
      setAdjustId(null);
      setAdjustSrc(null);
    }
    setMedia((prev) => prev.filter((entry) => entry.id !== id));
  }

  function openAdjust(item: ComposerMedia) {
    setCropBlocked(false);
    if (item.file) {
      const url = URL.createObjectURL(item.file);
      previewUrlsRef.current.push(url);
      setAdjustSrc(url);
    } else if (item.originalReference || item.reference) {
      setAdjustSrc(mediaUrl(item.originalReference || item.reference));
    }
    setAdjustId(item.id);
  }

  const createPost = useMutation({
    mutationFn: () => {
      const images = ordered.filter((item) => item.kind === "image" && item.status === "ready" && item.reference).map((item) => item.reference!);
      const videos = ordered.filter((item) => item.kind === "video" && item.status === "ready" && item.reference).map((item) => item.reference!);
      return api.createPost({
        content: content.trim() || undefined,
        image_urls: images.length ? images : undefined,
        video_urls: videos.length ? videos : undefined,
        location: location.trim() || undefined,
        vehicle_id: vehicleId || undefined,
      });
    },
    onSuccess: (post) => {
      publishingRef.current = false;
      sessionRef.current += 1;
      if (user) clearPostDraft(user.id);
      for (const item of media) revokePreview(item.previewUrl);
      setContent("");
      setLocation("");
      setVehicleId("");
      setStarter("");
      setMedia([]);
      setLeaveOpen(false);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-posts"] });
      toast.success(t("composer.published"), {
        action: {
          label: t("viewPost"),
          onClick: () => navigate(`/posts/${post.id}`),
        },
      });
      onPublished?.();
      onClose();
    },
    onError: (err: Error) => {
      publishingRef.current = false;
      toast.error(err.message || t("composer.publishFailed"));
    },
  });

  const canPublish = (content.trim().length > 0 || readyItems.length > 0) && !blocked && !createPost.isPending;

  const saveLabel = saveState === "saving"
    ? t("composer.saving")
    : saveState === "saved"
      ? t("composer.saved")
      : saveState === "error"
        ? t("composer.saveError")
        : "";

  const adjustItem = ordered.find((item) => item.id === adjustId);

  if (!open) return null;

  const tree = (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center md:items-center md:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={requestClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-[100dvh] w-full flex-col bg-card md:h-[min(88vh,860px)] md:max-w-[1080px] md:rounded-2xl md:border md:border-border"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">{t("createPost")}</h2>
            {user && (
              <div className="mt-2 flex items-center gap-2">
                <Avatar user={user} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayName(user)}</p>
                  <p className="text-xs text-muted-foreground">{t("composer.audience")}</p>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("composer.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex border-b border-border md:hidden" role="tablist" aria-label={t("createPost")}>
          {(["edit", "preview"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mobileTab === tab}
              onClick={() => setMobileTab(tab)}
              className={cn(
                "flex-1 py-2 text-sm",
                mobileTab === tab ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {tab === "edit" ? t("composer.editTab") : t("composer.previewTab")}
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1.15fr)_minmax(280px,400px)]">
          <div className={cn("min-h-0 overflow-y-auto px-4 py-4 space-y-4", mobileTab !== "edit" && "hidden md:block")}>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("composer.placeholder")}>
              {STARTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={starter === item.id}
                  onClick={() => setStarter((current) => current === item.id ? "" : item.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    starter === item.id ? "border-primary bg-primary/10" : "border-border text-muted-foreground",
                  )}
                >
                  {t(item.label)}
                </button>
              ))}
            </div>

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t(placeholderKey)}
              rows={5}
              className="w-full resize-none rounded-2xl border border-border bg-muted/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />

            <div
              className={cn(
                "rounded-2xl border border-dashed px-4 py-5 text-center",
                dragOver ? "border-primary bg-primary/5" : "border-border",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
              }}
            >
              <ImagePlus className="mx-auto mb-2 h-5 w-5 text-primary" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  replaceIdRef.current = null;
                  fileInputRef.current?.click();
                }}
                className="text-sm font-medium"
              >
                {t("composer.drop")}
              </button>
              <p className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <span className="block" dir="auto">{t("composer.limitsImages", { mb: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)) })}</span>
                <span className="block" dir="auto">{t("composer.limitsVideo", { mb: Math.round(MAX_VIDEO_BYTES / (1024 * 1024)), seconds: MAX_POST_VIDEO_DURATION_SEC })}</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                aria-label={t("composer.addMedia")}
                onChange={(event) => {
                  const files = event.target.files;
                  const replaceId = replaceIdRef.current;
                  replaceIdRef.current = null;
                  if (files?.length) addFiles(files, replaceId ?? undefined);
                  event.target.value = "";
                }}
              />
            </div>

            {hasImage && hasVideo && (
              <p className="text-xs text-muted-foreground">{t("composer.feedOrderHint")}</p>
            )}

            {ordered.length > 0 && (
              <ul className="space-y-3">
                {ordered.map((item, index) => {
                  const leadId = (ordered.find((entry) => entry.kind === "image") ?? ordered[0])?.id;
                  const statusText = item.status === "uploading"
                    ? (item.progress == null ? t("composer.statusUploading") : t("composer.statusUploadingPercent", { percent: item.progress }))
                    : item.status === "pending"
                      ? t("composer.statusPending")
                      : item.status === "failed"
                        ? t("composer.statusFailed")
                        : t("composer.statusReady");
                  const earlier = index > 0 && ordered[index - 1]?.kind === item.kind;
                  const later = index < ordered.length - 1 && ordered[index + 1]?.kind === item.kind;
                  return (
                    <li
                      key={item.id}
                      draggable
                      onDragStart={() => { dragIdRef.current = item.id; }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        const fromId = dragIdRef.current;
                        dragIdRef.current = null;
                        if (!fromId || fromId === item.id) return;
                        setMedia((prev) => {
                          const list = feedOrder(prev);
                          const from = list.findIndex((entry) => entry.id === fromId);
                          const to = list.findIndex((entry) => entry.id === item.id);
                          if (from < 0 || to < 0 || list[from].kind !== list[to].kind) return list;
                          const next = list.slice();
                          const [moved] = next.splice(from, 1);
                          next.splice(to, 0, moved);
                          return feedOrder(next);
                        });
                      }}
                      className="rounded-2xl border border-border bg-background p-3"
                    >
                      <div className="flex gap-3">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-black">
                          {item.kind === "image" && item.reference ? (
                            <img src={mediaUrl(item.reference)} alt="" className="h-full w-full object-contain" />
                          ) : item.kind === "video" && (item.previewUrl || item.reference) ? (
                            <video
                              src={item.previewUrl || mediaUrl(item.reference)}
                              className="h-full w-full object-contain"
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-white/70">{item.kind === "video" ? t("video") : t("image")}</div>
                          )}
                          <span className="absolute top-1 start-1 rounded-full bg-black/70 px-1.5 text-[10px] text-white">{index + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm">{item.name}</p>
                          {leadId === item.id && item.status === "ready" && (
                            <p className="text-[11px] font-medium text-primary">{t("composer.firstInFeed")}</p>
                          )}
                          <p className="text-xs text-muted-foreground" role="status">{statusText}</p>
                          {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                          <div className="flex flex-wrap gap-1 pt-1">
                            <button type="button" className="rounded-lg border border-border px-2 py-1 text-[11px]" disabled={!earlier} onClick={() => setMedia((prev) => move(prev, item.id, -1))} aria-label={t("composer.moveEarlier")}>
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="rounded-lg border border-border px-2 py-1 text-[11px]" disabled={!later} onClick={() => setMedia((prev) => move(prev, item.id, 1))} aria-label={t("composer.moveLater")}>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            {item.reference && (
                              <button type="button" className="rounded-lg border border-border px-2 py-1 text-[11px]" onClick={() => { setZoomIndex(Math.max(0, previewMedia.findIndex((entry) => entry.url === item.reference))); setZoomOpen(true); }} aria-label={t("composer.enlarge")}>
                                {t("composer.enlarge")}
                              </button>
                            )}
                            {item.kind === "image" && item.status === "ready" && (
                              <button type="button" className="rounded-lg border border-border px-2 py-1 text-[11px]" onClick={() => openAdjust(item)} aria-label={t("composer.editCrop")}>
                                {t("composer.editCrop")}
                              </button>
                            )}
                            <button
                              type="button"
                              className="rounded-lg border border-border px-2 py-1 text-[11px]"
                              onClick={() => {
                                replaceIdRef.current = item.id;
                                fileInputRef.current?.click();
                              }}
                              aria-label={t("composer.replace")}
                            >
                              <Replace className="h-3.5 w-3.5" />
                            </button>
                            {item.status === "failed" && item.file && (
                              <button type="button" className="rounded-lg border border-border px-2 py-1 text-[11px]" onClick={() => enqueue(item.id, item.file!, true)}>
                                {t("composer.retry")}
                              </button>
                            )}
                            {item.status === "failed" && !item.file && (
                              <button type="button" className="rounded-lg border border-border px-2 py-1 text-[11px]" onClick={() => { replaceIdRef.current = item.id; fileInputRef.current?.click(); }}>
                                {t("composer.reselect")}
                              </button>
                            )}
                            <button type="button" className="rounded-lg border border-border px-2 py-1 text-[11px] text-destructive" onClick={() => removeMedia(item.id)} aria-label={t("composer.remove")}>
                              {t("composer.remove")}
                            </button>
                          </div>
                        </div>
                      </div>
                      {item.kind === "video" && (item.previewUrl || item.reference) && (
                        <video
                          src={item.previewUrl || mediaUrl(item.reference)}
                          className="mt-3 max-h-64 w-full rounded-xl bg-black object-contain"
                          controls
                          playsInline
                          preload="metadata"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {adjustItem && adjustSrc && !cropBlocked && (
              <PostImageAdjust
                src={adjustSrc}
                fileName={adjustItem.name}
                canReset={Boolean(adjustItem.originalReference && adjustItem.reference && adjustItem.originalReference !== adjustItem.reference)}
                busy={adjustItem.status === "uploading"}
                onCancel={() => {
                  setAdjustId(null);
                  setAdjustSrc(null);
                }}
                onReset={() => {
                  setMedia((prev) => prev.map((item) => item.id === adjustItem.id && item.originalReference
                    ? { ...item, reference: item.originalReference, error: undefined, status: "ready" }
                    : item));
                  setAdjustId(null);
                  setAdjustSrc(null);
                }}
                onApply={(file) => {
                  setMedia((prev) => prev.map((item) => item.id === adjustItem.id ? { ...item, status: "pending", error: undefined } : item));
                  enqueue(adjustItem.id, file, false);
                  setAdjustId(null);
                  setAdjustSrc(null);
                }}
                onSourceError={() => setCropBlocked(true)}
              />
            )}
            {cropBlocked && (
              <p className="text-xs text-destructive">{t("composer.cropNeedsFile")}</p>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t("composer.linkTool")}</h3>
              {vehicles.length === 0 ? (
                <Link to="/profile?tab=garage" onClick={onClose} className="text-sm text-primary hover:underline">
                  {t("composer.addTool")}
                </Link>
              ) : (
                <>
                  {vehicles.length > 4 && (
                    <Input
                      value={toolQuery}
                      onChange={(event) => setToolQuery(event.target.value)}
                      placeholder={t("composer.searchTools")}
                      aria-label={t("composer.searchTools")}
                      className="h-10"
                    />
                  )}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      aria-pressed={!vehicleId}
                      onClick={() => setVehicleId("")}
                      className={cn("shrink-0 rounded-2xl border px-3 py-3 text-sm", !vehicleId ? "border-primary bg-primary/10" : "border-border")}
                    >
                      {t("composer.noTool")}
                    </button>
                    {filteredVehicles.map((vehicle) => (
                      <button
                        key={vehicle.id}
                        type="button"
                        aria-pressed={vehicleId === vehicle.id}
                        onClick={() => setVehicleId(vehicle.id)}
                        className={cn(
                          "flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border text-start",
                          vehicleId === vehicle.id ? "border-primary bg-primary/10" : "border-border",
                        )}
                      >
                        {vehicle.image_urls?.[0] ? (
                          <img src={mediaUrl(pickStoredImageUrl(vehicle.image_urls[0], vehicle.image_media, "feed"))} alt="" className="h-20 w-full object-cover" />
                        ) : (
                          <span className="flex h-20 items-center justify-center bg-muted text-xs text-muted-foreground">{vehicle.make.slice(0, 1)}</span>
                        )}
                        <span className="truncate px-2 py-2 text-xs">{vehicleLabel(vehicle)}</span>
                      </button>
                    ))}
                  </div>
                  {selectedVehicle && (
                    <button type="button" onClick={() => setVehicleId("")} className="text-xs text-muted-foreground underline" aria-label={t("composer.clearTool")}>
                      {t("composer.clearTool")}
                    </button>
                  )}
                </>
              )}
            </section>

            <details className="rounded-2xl border border-border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">{t("composer.details")}</summary>
              <div className="space-y-2 pt-3">
                <label className="block text-xs text-muted-foreground" htmlFor="post-location">{t("composer.location")}</label>
                <Input
                  id="post-location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder={t("locationPlaceholder")}
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">{t("composer.locationHint")}</p>
                {location && (
                  <button type="button" className="text-xs underline" onClick={() => setLocation("")} aria-label={t("composer.clearLocation")}>
                    {t("composer.clearLocation")}
                  </button>
                )}
              </div>
            </details>
          </div>

          <aside className={cn("min-h-0 overflow-y-auto border-border bg-muted/20 px-4 py-4 md:border-s", mobileTab !== "preview" && "hidden md:block")}>
            <h3 className="mb-3 text-sm font-medium">{t("composer.previewTitle")}</h3>
            <article className="overflow-hidden rounded-2xl border border-border bg-card">
              {user && (
                <div className="flex items-center gap-2 px-3 py-3">
                  <Avatar user={user} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayName(user)}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">{formatHandle(user)}</p>
                  </div>
                </div>
              )}
              {content.trim() ? (
                <p className="whitespace-pre-wrap px-3 pb-3 text-sm">{content}</p>
              ) : (
                <p className="px-3 pb-3 text-sm text-muted-foreground">{t("composer.previewEmpty")}</p>
              )}
              {previewMedia.length > 0 && (
                <PostMediaCarousel items={previewMedia} mode="feed" mediaClassName="max-h-72" />
              )}
              <div className="space-y-2 px-3 py-3">
                {location.trim() && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    {location.trim()}
                  </p>
                )}
                {selectedVehicle && <VehicleBadge label={vehicleLabel(selectedVehicle)} />}
              </div>
            </article>
          </aside>
        </div>

        <footer className="flex items-center gap-3 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="min-h-4 flex-1 text-xs text-muted-foreground" aria-live="polite">{saveLabel}</p>
          <Button
            type="button"
            className="!shadow-none"
            disabled={!canPublish}
            aria-busy={createPost.isPending}
            onClick={() => {
              if (publishingRef.current || !canPublish) return;
              publishingRef.current = true;
              createPost.mutate();
            }}
          >
            {createPost.isPending ? t("composer.publishing") : t("publish")}
          </Button>
        </footer>

        {leaveOpen && (
          <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="alertdialog" aria-labelledby="leave-draft-title" aria-describedby="leave-draft-body">
            <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-4">
              <h3 id="leave-draft-title" className="font-semibold">{t("composer.leaveTitle")}</h3>
              <p id="leave-draft-body" className="text-sm text-muted-foreground">{t("composer.leaveBody")}</p>
              <div className="flex flex-col gap-2">
                <Button type="button" className="!shadow-none" onClick={persistAndClose}>{t("composer.leaveSave")}</Button>
                <Button type="button" variant="outline" onClick={discardAndClose}>{t("composer.leaveDelete")}</Button>
                <Button type="button" variant="ghost" onClick={() => setLeaveOpen(false)}>{t("composer.leaveStay")}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <MediaLightbox
        open={zoomOpen}
        items={previewMedia.map((item) => item.type === "video"
          ? { kind: "video" as const, src: mediaUrl(item.url) }
          : { kind: "image" as const, src: mediaUrl(item.url) })}
        index={zoomIndex}
        onClose={() => setZoomOpen(false)}
        onIndexChange={setZoomIndex}
      />
    </div>
  );
  return createPortal(tree, document.body);
}

function move(items: ComposerMedia[], id: string, direction: -1 | 1): ComposerMedia[] {
  const list = feedOrder(items);
  const index = list.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length || list[target].kind !== list[index].kind) return list;
  const next = list.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return feedOrder(next);
}
