import { Camera, Hash, Warehouse } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { EXPLORE_TABS, type ExploreTab } from "./types";

const TAB_META: Record<ExploreTab, { icon: typeof Camera; labelKey: string }> = {
  photos: { icon: Camera, labelKey: "exploreTabPhotos" },
  vehicles: { icon: Warehouse, labelKey: "exploreTabVehicles" },
  tags: { icon: Hash, labelKey: "exploreTabTags" },
};

interface ExploreTabsProps {
  active: ExploreTab;
  onChange: (tab: ExploreTab) => void;
}

export default function ExploreTabs({ active, onChange }: ExploreTabsProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex p-1 gap-1 glass-card rounded-2xl"
      role="tablist"
      aria-label={t("explore")}
    >
      {EXPLORE_TABS.map((tab) => {
        const { icon: Icon, labelKey } = TAB_META[tab];
        const isActive = active === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
