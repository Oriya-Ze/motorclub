import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarColors, avatarInitial } from "@/lib/avatar";
import { mediaUrl } from "@/lib/media";

type AvatarUser = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  profile_picture_url?: string | null;
};

const SIZES = {
  xs: "w-7 h-7 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
  "2xl": "w-24 h-24 text-3xl",
} as const;

interface AvatarProps {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
  /** Open the photo full-size on click. Only applies when a profile picture exists. */
  preview?: boolean;
}

export default function Avatar({ user, size = "md", className, preview = false }: AvatarProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const seed = user.id ?? user.email ?? user.full_name ?? "user";
  const colors = avatarColors(seed);
  const initial = avatarInitial(user.full_name ?? user.email);
  const src = user.profile_picture_url ? mediaUrl(user.profile_picture_url) : null;
  const canPreview = preview && Boolean(src);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const face = src ? (
    <div className={cn("rounded-full overflow-hidden shrink-0 bg-muted", SIZES[size], className)}>
      <img src={src} alt="" className="w-full h-full object-cover" />
    </div>
  ) : (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold shrink-0", SIZES[size], className)}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {initial}
    </div>
  );

  return (
    <>
      {canPreview ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="shrink-0 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={t("profile.viewPhoto")}
        >
          {face}
        </button>
      ) : (
        face
      )}
      {open && src
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={t("profile.viewPhoto")}>
              <button
                type="button"
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 end-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label={t("close")}
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={src}
                alt={t("profile.viewPhoto")}
                className="relative z-10 w-[min(90vw,28rem)] h-[min(90vw,28rem)] max-h-[85vh] rounded-full object-cover shadow-2xl ring-4 ring-white/15"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
