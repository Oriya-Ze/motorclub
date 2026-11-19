import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Marks a vehicle added by licence plate: make, model, year, trim, engine and colour came from the Ministry of
 * Transport registry and cannot be edited. The word says it, not only the colour.
 */
export default function VerifiedVehicleBadge({ overlay = false, className }: { overlay?: boolean; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      title={t("garage.verifiedHint")}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        overlay
          ? "bg-black/65 text-emerald-300 backdrop-blur-sm"
          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        className,
      )}
    >
      <ShieldCheck className="h-3 w-3" aria-hidden />
      {t("garage.verified")}
      <span className="sr-only">{` — ${t("garage.verifiedHint")}`}</span>
    </span>
  );
}
