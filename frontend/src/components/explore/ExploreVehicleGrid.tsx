import { Warehouse } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import FitImage from "@/components/FitImage";
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
  nickname?: string | null;
  thumbnail?: string | null;
  has_mods?: boolean;
  owner?: User | null;
}

/** The card photo, or the placeholder when there is no public copy yet (still processing) or it fails to load. */
function VehicleThumb({ thumbnail, alt }: { thumbnail?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const src = thumbnail ? mediaUrl(thumbnail) : "";
  if (!src || failed) return <VehiclePlaceholder className="absolute inset-0 h-full w-full" iconClassName="w-8 h-8" />;
  return <FitImage src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full" />;
}

interface ExploreVehicleGridProps {
  vehicles: ExploreVehicleItem[];
  isLoading?: boolean;
}

/** Vehicles in a grid of cards: a 16:9 photo, like every vehicle frame on the site, then the name and owner. */
export default function ExploreVehicleGrid({ vehicles, isLoading }: ExploreVehicleGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return <CardGridSkeleton count={6} className="grid-cols-2 sm:grid-cols-3" />;
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={Warehouse}
        title={t("exploreVehiclesEmpty")}
        description={t("exploreVehiclesEmptyDesc")}
        action={
          <Button onClick={() => navigate("/profile?tab=garage")}>{t("exploreAddVehicle")}</Button>
        }
        className="py-12"
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {vehicles.map((v) => {
        const name = `${v.year ? `${v.year} ` : ""}${v.make} ${v.model}`;
        return (
          <li key={v.id} className="min-w-0">
            <Link
              to={`/vehicles/${v.id}`}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <div className="relative aspect-video bg-black">
                <VehicleThumb thumbnail={v.thumbnail} alt={name} />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                {v.nickname?.trim() && <p className="truncate text-xs font-medium text-primary">{v.nickname}</p>}
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{name}</p>
                {v.owner && (
                  <p className="mt-auto inline-flex min-w-0 items-center gap-1 pt-1 text-xs text-muted-foreground">
                    <span className="truncate">{formatHandle(v.owner)}</span>
                    {v.owner.is_verified && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
                  </p>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
