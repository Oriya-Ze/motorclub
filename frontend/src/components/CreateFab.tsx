import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CreateFabProps {
  onClick: () => void;
}

const BOLT_PATHS = [
  "M14 18 L18 24 L16 24 L22 32 L18 26 L28 26 L24 20 L32 16",
  "M58 20 L54 26 L56 26 L50 34 L54 28 L44 28 L48 22 L40 18",
  "M16 54 L20 48 L18 48 L24 40 L20 46 L30 46 L26 52 L34 56",
  "M56 52 L52 46 L54 46 L48 38 L52 44 L42 44 L46 50 L38 54",
  "M36 8 L34 14 L36 14 L32 20 L35 15 L39 15 L37 10 L42 8",
  "M8 36 L14 34 L14 36 L20 32 L15 35 L15 39 L10 37 L8 42",
  "M64 36 L58 38 L58 36 L52 40 L57 37 L57 33 L62 35 L64 30",
  "M36 64 L38 58 L36 58 L40 52 L37 57 L33 57 L35 62 L30 64",
] as const;

export default function CreateFab({ onClick }: CreateFabProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const visible = pathname === "/" || pathname === "/explore";
  if (!visible) return null;

  return (
    <div
      className={cn(
        "create-fab-wrap md:hidden fixed z-[60]",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] end-4",
      )}
    >
      <svg
        className="create-fab__electric"
        viewBox="0 0 72 72"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="createFabBoltGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(48 100% 72%)" />
            <stop offset="45%" stopColor="hsl(38 100% 58%)" />
            <stop offset="100%" stopColor="hsl(25 95% 52%)" />
          </linearGradient>
          <filter id="createFabBoltGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#createFabBoltGlow)">
          {BOLT_PATHS.map((d, i) => (
            <path
              key={i}
              className="create-fab__bolt"
              d={d}
              style={{ animationDelay: `${i * 0.27}s` }}
            />
          ))}
        </g>
      </svg>

      <span className="create-fab__halo" aria-hidden />

      <button
        type="button"
        onClick={onClick}
        aria-label={t("createPost")}
        className={cn(
          "create-fab",
          "flex h-14 w-14 items-center justify-center rounded-2xl",
          "transition-transform active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <span className="create-fab__lens" aria-hidden />
        <Plus className="create-fab__icon w-7 h-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
