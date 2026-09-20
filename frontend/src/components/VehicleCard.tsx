import { Camera, Star, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import { Card, CardContent } from "@/components/ui/Card";
import { Vehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { pickStoredImageUrl } from "@/lib/postMedia";
import { cn } from "@/lib/utils";

type Props = {
  vehicle: Vehicle;
  featured?: boolean;
  showPrimary?: boolean;
};

export default function VehicleCard({ vehicle: v, featured = false, showPrimary = false }: Props) {
  const { t } = useTranslation();
  const title = [v.year, v.make, v.model].filter(Boolean).join(" ");
  const alt = title || t("garage.title");

  return (
    <Link
      to={`/vehicles/${v.id}`}
      className={cn(
        "text-start rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        featured && "sm:col-span-2"
      )}
    >
      <Card className="overflow-hidden hover:shadow-glow transition-shadow h-full cursor-pointer">
        <div className="relative">
          {v.image_urls?.[0] ? (
            <img
              src={mediaUrl(pickStoredImageUrl(v.image_urls[0], v.image_media, "feed"))}
              alt={alt}
              className={cn("w-full object-cover", featured ? "h-52" : "h-40")}
              loading="lazy"
            />
          ) : (
            <VehiclePlaceholder className={featured ? "h-52" : "h-40"} />
          )}
          <div className="absolute top-2 start-2 flex flex-wrap gap-1.5">
            {showPrimary && v.is_primary && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                <Star className="w-3 h-3 fill-current" />
                {t("garage.primaryBadge")}
              </span>
            )}
            {(v.image_urls?.length ?? 0) > 1 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/55 text-white">
                <Camera className="w-3 h-3" />
                {v.image_urls!.length}
              </span>
            )}
          </div>
        </div>
        <CardContent className="pt-4">
          <h3 className={cn("font-bold", featured ? "text-xl" : "text-lg")}>{v.nickname?.trim() || title}</h3>
          {v.nickname?.trim() ? (
            <p className="text-sm text-muted-foreground">{title}{v.trim ? ` · ${v.trim}` : ""}</p>
          ) : (
            v.trim && <p className="text-sm text-muted-foreground">{v.trim}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            {v.color && <span>{v.color}</span>}
            {v.engine && <span>{v.engine}</span>}
            {((v.mod_items && v.mod_items.length > 0) || v.mods) && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Wrench className="w-3 h-3" />
                {t("garage.hasMods")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
