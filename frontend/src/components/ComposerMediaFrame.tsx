import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { mediaUrl } from "@/lib/media";
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
  const candidates = useMemo(() => {
    if (localUrl) return [localUrl];
    if (!sourceKey) return [];
    const keys = kind === "video" ? videoPlayKeys(sourceKey) : imageViewKeys(sourceKey);
    return keys.map(resolveUrl).filter(Boolean);
  }, [kind, localUrl, sourceKey]);
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
    if (!candidates.length) setPhase("error");
    else if (candidates[0] === shownRef.current) setPhase("ready");
    else setPhase("loading");
  }, [candidateKey, candidates]);

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
