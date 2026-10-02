import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { API_BASE, isPrivateMediaKey, mediaUrl } from "@/lib/media";
import { imageViewKeys, videoPlayKeys, videoPosterKey } from "@/lib/mediaVariants";
import { cn } from "@/lib/utils";

function resolveUrl(value: string): string {
  if (value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://")) return value;
  return mediaUrl(value);
}

interface ComposerMediaFrameProps {
  kind: "image" | "video";
  sourceKey?: string;
  localUrl?: string;
  className?: string;
  controls?: boolean;
  muted?: boolean;
}

export default function ComposerMediaFrame({
  kind,
  sourceKey,
  localUrl,
  className,
  controls = false,
  muted = false,
}: ComposerMediaFrameProps) {
  const { t } = useTranslation();
  const [privateUrl, setPrivateUrl] = useState<string | null>(null);
  const [privateFailed, setPrivateFailed] = useState(false);
  const waitingForPrivate = Boolean(sourceKey && isPrivateMediaKey(sourceKey) && !localUrl);

  useEffect(() => {
    if (!waitingForPrivate || !sourceKey) {
      setPrivateUrl(null);
      setPrivateFailed(false);
      return;
    }
    let stop = false;
    let blobUrl = "";
    setPrivateFailed(false);
    setPrivateUrl(null);
    api.mediaAccessUrl(sourceKey).then(async (result) => {
      const target = result.url.startsWith("/") ? `${API_BASE}${result.url}` : result.url;
      if (/^https?:\/\//.test(target) && !target.includes("/media/private-file")) {
        if (!stop) setPrivateUrl(target);
        return;
      }
      const response = await fetch(target, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
      });
      if (!response.ok) throw new Error("preview failed");
      blobUrl = URL.createObjectURL(await response.blob());
      if (stop) URL.revokeObjectURL(blobUrl);
      else setPrivateUrl(blobUrl);
    }).catch(() => {
      if (!stop) setPrivateFailed(true);
    });
    return () => {
      stop = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [sourceKey, waitingForPrivate]);

  const candidates = useMemo(() => {
    if (localUrl) return [localUrl];
    if (privateUrl) return [privateUrl];
    if (waitingForPrivate) return [];
    if (!sourceKey) return [];
    const keys = kind === "video" ? videoPlayKeys(sourceKey) : imageViewKeys(sourceKey);
    return keys.map(resolveUrl).filter(Boolean);
  }, [kind, localUrl, privateUrl, sourceKey, waitingForPrivate]);
  const candidateKey = candidates.join("|");
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const shownRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  shownRef.current = shown;
  const current = candidates[attempt] ?? "";

  useEffect(() => {
    attemptRef.current = 0;
    setAttempt(0);
    if (!candidates.length) setPhase(waitingForPrivate && !privateFailed ? "loading" : "error");
    else if (candidates[0] === shownRef.current) setPhase("ready");
    else setPhase("loading");
  }, [candidateKey, candidates, privateFailed, waitingForPrivate]);

  useEffect(() => {
    if (phase !== "loading" || !current) return;
    if (current === shownRef.current) {
      setPhase("ready");
      return;
    }
    let cancelled = false;
    const fail = () => {
      if (cancelled) return;
      const next = attemptRef.current + 1;
      if (next < candidates.length) {
        attemptRef.current = next;
        setAttempt(next);
        return;
      }
      setPhase("error");
    };
    if (kind === "image") {
      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        setShown(current);
        setPhase("ready");
      };
      image.onerror = fail;
      image.src = current;
      return () => {
        cancelled = true;
      };
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadeddata = () => {
      if (cancelled) return;
      setShown(current);
      setPhase("ready");
    };
    video.onerror = fail;
    video.src = current;
    return () => {
      cancelled = true;
      video.src = "";
    };
  }, [candidates.length, current, kind, phase]);

  const poster = kind === "video" && sourceKey && !localUrl ? resolveUrl(videoPosterKey(sourceKey) || "") : "";

  return (
    <div className={cn("relative overflow-hidden bg-black", className)}>
      {kind === "image" && shown ? (
        <img src={shown} alt="" className="h-full w-full object-contain" />
      ) : null}
      {kind === "video" && shown && phase === "ready" ? (
        <video
          key={shown}
          src={shown}
          poster={poster || undefined}
          className="h-full w-full object-contain"
          controls={controls}
          muted={muted || !controls}
          playsInline
          preload="metadata"
        />
      ) : null}
      {phase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="sr-only">{t("composer.mediaLoading")}</span>
        </div>
      )}
      {phase === "error" && (
        <p className={cn(
          "px-2 text-center text-[11px] text-white",
          shown ? "absolute bottom-1 inset-x-1 rounded bg-black/70" : "absolute inset-0 flex items-center justify-center",
        )} role="alert">
          {t("composer.mediaFailed")}
        </p>
      )}
    </div>
  );
}
