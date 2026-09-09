import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CreateFabProps {
  onClick: () => void;
}

/** Rounded rect tracing the button frame (viewBox 0 0 72 72). */
const FRAME_PATH =
  "M 22 9 H 50 A 13 13 0 0 1 63 22 V 50 A 13 13 0 0 1 50 63 H 22 A 13 13 0 0 1 9 50 V 22 A 13 13 0 0 1 22 9 Z";

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
      <svg className="create-fab__electric" viewBox="0 0 72 72" fill="none" aria-hidden>
        <defs>
          <linearGradient id="createFabFlowGrad" gradientUnits="userSpaceOnUse" x1="9" y1="9" x2="63" y2="63">
            <stop offset="0%" stopColor="hsl(48 100% 72% / 0.9)" />
            <stop offset="50%" stopColor="hsl(38 100% 58% / 0.85)" />
            <stop offset="100%" stopColor="hsl(25 95% 52% / 0.9)" />
          </linearGradient>
          <filter id="createFabFlowSoft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <filter id="createFabDistort" x="-35%" y="-35%" width="170%" height="170%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.016 0.019"
              numOctaves="3"
              seed="4"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                dur="18s"
                values="0.016 0.019;0.021 0.016;0.016 0.019"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter="url(#createFabFlowSoft)">
          <path
            className="create-fab__flow create-fab__flow--a"
            d={FRAME_PATH}
            pathLength={100}
          />
          <path
            className="create-fab__flow create-fab__flow--b"
            d={FRAME_PATH}
            pathLength={100}
          />
          <path
            className="create-fab__flow create-fab__flow--c"
            d={FRAME_PATH}
            pathLength={100}
          />
        </g>
      </svg>

      <button
        type="button"
        onClick={onClick}
        aria-label={t("createPost")}
        className={cn(
          "create-fab",
          "flex h-14 w-14 items-center justify-center rounded-2xl",
          "transition-transform active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        <span className="create-fab__distort" aria-hidden />
        <Plus className="create-fab__icon w-7 h-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
