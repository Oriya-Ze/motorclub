import { Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export default function BusinessListingBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-glow ring-1 ring-white/25",
        className
      )}
      title={t("marketplaceBusinessHint")}
    >
      <Store className="h-3 w-3" aria-hidden />
      {t("marketplaceBusinessBadge")}
    </span>
  );
}
