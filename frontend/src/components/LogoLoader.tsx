import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-7 w-7",
  md: "h-14 w-14",
  lg: "h-16 w-16",
};

/** The site's loading indicator: the logo, breathing, with a ring spreading from it. */
export default function LogoLoader({
  size = "md",
  fullScreen = false,
  delayed = false,
  className,
}: {
  size?: keyof typeof SIZES;
  /** Fills the screen on the app background, for waits before any page is shown. */
  fullScreen?: boolean;
  /** Shows only if the wait lasts a moment, so fast loads do not flash it. */
  delayed?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const loader = (
    <div role="status" aria-label={t("loading")} className={cn("logo-loader", SIZES[size], delayed && "logo-loader--delayed", className)}>
      <span className="logo-loader__ring" aria-hidden />
      <img src="/logo-192.png" alt="" className="logo-loader__mark" draggable={false} />
    </div>
  );
  if (!fullScreen) return loader;
  return <div className="min-h-screen gradient-bg flex items-center justify-center">{loader}</div>;
}
