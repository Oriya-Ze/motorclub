import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface CreateFabProps {
  onClick: () => void;
}

export default function CreateFab({ onClick }: CreateFabProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const visible = pathname === "/" || pathname === "/explore";
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("createPost")}
      className={cn(
        "md:hidden fixed z-40",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] end-4",
        "flex h-14 w-14 items-center justify-center rounded-2xl",
        "gradient-primary text-white shadow-glow",
        "ring-4 ring-background/90",
        "transition-transform active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <Plus className="w-7 h-7" strokeWidth={2.5} />
    </button>
  );
}
