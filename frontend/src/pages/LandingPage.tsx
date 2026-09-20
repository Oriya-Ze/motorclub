import { Building2, Car, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/Button";
import { api, type ExploreVehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { formatHandle } from "@/lib/utils";

function vehicleScore(vehicle: ExploreVehicle): number {
  const preview = vehicle.mod_preview;
  const hasShop = Boolean(preview?.shop_id && preview.shop_name);
  const hasMods = Boolean(vehicle.has_mods || preview?.name);
  const hasDescription = Boolean(vehicle.description?.trim());
  const hasNickname = Boolean(vehicle.nickname?.trim());
  return (hasShop ? 8 : 0) + (hasMods ? 4 : 0) + (hasDescription ? 2 : 0) + (hasNickname ? 1 : 0);
}

function vehicleTitle(vehicle: ExploreVehicle): string {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

export default function LandingPage() {
  const { t } = useTranslation();
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["explore-vehicles"],
    queryFn: () => api.exploreVehicles(),
    staleTime: 60_000,
  });

  const ranked = [...vehicles].sort((a, b) => vehicleScore(b) - vehicleScore(a));
  const featured = ranked[0];
  const showcase = ranked.slice(1, 4);

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-8">
      <section className="text-center space-y-4 pt-4 sm:pt-8">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto" />
        <h1 className="text-3xl sm:text-4xl font-display tracking-wide">{t("appTitle")}</h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">{t("appSubtitle")}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link to="/auth?register=1">
            <Button size="lg">{t("landing.join")}</Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            type="button"
            onClick={() => document.getElementById("landing-cars")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            {t("landing.discover")}
          </Button>
        </div>
      </section>

      {isLoading ? (
        <div className="h-56 sm:h-72 rounded-3xl bg-muted/40 animate-pulse" />
      ) : featured ? (
        <FeaturedVehicle vehicle={featured} />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <Pillar icon={Car} title={t("landing.pillarPassportTitle")} body={t("landing.pillarPassportBody")} />
        <Pillar icon={Wrench} title={t("landing.pillarBuildTitle")} body={t("landing.pillarBuildBody")} />
        <Pillar icon={Building2} title={t("landing.pillarShopTitle")} body={t("landing.pillarShopBody")} />
      </section>

      <section id="landing-cars" className="space-y-3 scroll-mt-20">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("landing.passportsTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("landing.passportsHint")}</p>
        </div>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : !featured ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("landing.passportsEmpty")}</p>
        ) : showcase.length === 0 ? null : (
          <div className="grid gap-3 sm:grid-cols-3">
            {showcase.map((v) => (
              <VehicleCard key={v.id} vehicle={v} />
            ))}
          </div>
        )}
      </section>

      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-4 text-xs text-muted-foreground border-t border-border/50">
        <Link to="/privacy-policy" className="hover:text-primary hover:underline">{t("privacyPolicy")}</Link>
        <Link to="/terms-of-service" className="hover:text-primary hover:underline">{t("termsOfService")}</Link>
        <a href="mailto:legal@motorclub.co.il" className="hover:text-primary hover:underline">{t("landing.contact")}</a>
      </footer>
    </div>
  );
}

function FeaturedVehicle({ vehicle }: { vehicle: ExploreVehicle }) {
  const { t } = useTranslation();
  const title = vehicleTitle(vehicle);
  const displayName = vehicle.nickname?.trim() || title;
  const description = vehicle.description?.trim();
  const preview = vehicle.mod_preview;

  return (
    <Link
      to={`/vehicles/${vehicle.id}`}
      className="block glass-card rounded-3xl overflow-hidden hover:shadow-glow transition-shadow"
    >
      {vehicle.thumbnail ? (
        <img
          src={mediaUrl(vehicle.thumbnail)}
          alt={displayName}
          className="w-full h-56 sm:h-72 object-cover"
        />
      ) : (
        <VehiclePlaceholder className="w-full h-56 sm:h-72" iconClassName="w-16 h-16" />
      )}
      <div className="p-4 sm:p-5 space-y-2">
        <h2 className="text-xl font-semibold leading-snug">{displayName}</h2>
        {vehicle.nickname?.trim() ? (
          <p className="text-sm text-muted-foreground">{title}</p>
        ) : null}
        {description ? (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{description}</p>
        ) : null}
        {preview?.name ? (
          <p className="text-sm text-primary inline-flex items-center gap-1.5">
            <Wrench className="w-4 h-4 shrink-0" />
            <span className="line-clamp-1">
              {preview.shop_name
                ? t("landing.modByShop", { mod: preview.name, shop: preview.shop_name })
                : preview.name}
            </span>
          </p>
        ) : null}
        {vehicle.owner && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
            {formatHandle(vehicle.owner)}
            {vehicle.owner.is_verified && <VerifiedBadge className="w-3.5 h-3.5" />}
          </p>
        )}
      </div>
    </Link>
  );
}

function VehicleCard({ vehicle }: { vehicle: ExploreVehicle }) {
  const { t } = useTranslation();
  const title = vehicleTitle(vehicle);
  const displayName = vehicle.nickname?.trim() || title;
  const preview = vehicle.mod_preview;

  return (
    <Link
      to={`/vehicles/${vehicle.id}`}
      className="flex gap-3 glass-card rounded-2xl p-3 hover:shadow-glow transition-shadow"
    >
      {vehicle.thumbnail ? (
        <img
          src={mediaUrl(vehicle.thumbnail)}
          alt={title}
          className="w-20 h-20 object-cover rounded-xl shrink-0"
        />
      ) : (
        <VehiclePlaceholder className="w-20 h-20 rounded-xl shrink-0" iconClassName="w-8 h-8" />
      )}
      <div className="min-w-0 flex flex-col justify-center">
        <p className="font-semibold text-sm leading-snug line-clamp-2">{displayName}</p>
        {vehicle.nickname?.trim() ? (
          <p className="text-xs text-muted-foreground truncate">{title}</p>
        ) : null}
        {preview?.name ? (
          <p className="text-xs text-primary mt-0.5 line-clamp-1">
            {preview.shop_name
              ? t("landing.modByShop", { mod: preview.name, shop: preview.shop_name })
              : preview.name}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function Pillar({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Car;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-4 space-y-2">
      <Icon className="w-5 h-5 text-primary" />
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
