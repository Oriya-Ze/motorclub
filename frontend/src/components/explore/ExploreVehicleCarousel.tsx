import { Warehouse } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import VerifiedBadge from "@/components/VerifiedBadge";
import { CardGridSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { User } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { formatHandle } from "@/lib/utils";

export interface ExploreVehicleItem {
  id: string;
  make: string;
  model: string;
  year?: number | null;
  thumbnail?: string | null;
  owner?: User | null;
}

interface ExploreVehicleCarouselProps {
  vehicles: ExploreVehicleItem[];
  isLoading?: boolean;
}

export default function ExploreVehicleCarousel({ vehicles, isLoading }: ExploreVehicleCarouselProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return <CardGridSkeleton count={4} />;
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={Warehouse}
        title={t("exploreVehiclesEmpty")}
        description={t("exploreVehiclesEmptyDesc")}
        action={
          <Button onClick={() => navigate("/garage")}>{t("exploreAddVehicle")}</Button>
        }
        className="py-12"
      />
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory md:grid md:grid-cols-2 md:overflow-visible md:pb-0">
      {vehicles.map((v) => (
        <Link
          key={v.id}
          to={v.owner ? `/profile/${v.owner.id}` : "#"}
          className="snap-start shrink-0 w-[min(82vw,300px)] md:w-auto flex gap-3 glass-card rounded-2xl p-3 hover:shadow-glow transition-shadow"
        >
          {v.thumbnail ? (
            <img
              src={mediaUrl(v.thumbnail)}
              alt=""
              className="w-20 h-20 object-cover rounded-xl shrink-0 ring-2 ring-[#F5D033]/25"
            />
          ) : (
            <VehiclePlaceholder className="w-20 h-20 rounded-xl shrink-0" iconClassName="w-8 h-8" />
          )}
          <div className="min-w-0 flex flex-col justify-center">
            <p className="font-semibold text-sm leading-snug line-clamp-2">
              {v.year ? `${v.year} ` : ""}
              {v.make} {v.model}
            </p>
            {v.owner && (
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1 truncate">
                {formatHandle(v.owner)}
                {v.owner.is_verified && <VerifiedBadge className="w-3.5 h-3.5" />}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
