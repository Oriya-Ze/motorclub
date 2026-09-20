import { Bike, Building2, Camera, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import VehicleImageCarousel from "@/components/VehicleImageCarousel";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/Button";
import { api, type ExploreVehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { formatHandle } from "@/lib/utils";

const DEMO_PHOTOS = [
  "/landing/landing-911-hero.jpg",
  "/landing/landing-911-rear.jpg",
  "/landing/landing-911-detail.jpg",
];

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

  const showcase = [...vehicles].sort((a, b) => vehicleScore(b) - vehicleScore(a)).slice(0, 3);

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

      <SamplePassport />

      <section className="grid gap-3 sm:grid-cols-3">
        <Pillar icon={Bike} title={t("landing.pillarPassportTitle")} body={t("landing.pillarPassportBody")} />
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
        ) : showcase.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("landing.passportsEmpty")}</p>
        ) : (
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

function SamplePassport() {
  const { t } = useTranslation();
  const mods = [
    { name: t("landing.sampleModExhaust"), shop: t("landing.sampleShopExhaust"), category: t("garage.modCategory.engine") },
    { name: t("landing.sampleModSuspension"), shop: t("landing.sampleShopSuspension"), category: t("garage.modCategory.suspension") },
    { name: t("landing.sampleModDetail"), shop: t("landing.sampleShopDetail"), category: t("garage.modCategory.exterior") },
  ];

  return (
    <section className="glass-card rounded-3xl overflow-hidden">
      <VehicleImageCarousel
        urls={DEMO_PHOTOS}
        className="rounded-none"
        imageClassName="rounded-none h-56 sm:h-80"
        alt={t("landing.sampleNickname")}
      />
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-display tracking-wide">{t("landing.sampleNickname")}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {t("landing.sampleBadge")}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{t("landing.sampleCatalog")}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {t("garage.followersCount", { count: 1284 })}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {t("garage.spotCount", { count: 56 })}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            <Camera className="w-3.5 h-3.5" />
            {t("garage.photoCount", { count: DEMO_PHOTOS.length })}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            <Wrench className="w-3.5 h-3.5" />
            {t("garage.hasMods")}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <SpecItem label={t("garage.year")} value="2023" />
          <SpecItem label={t("garage.color")} value={t("landing.sampleColor")} />
          <SpecItem label={t("garage.engine")} value={t("landing.sampleEngine")} />
          <SpecItem label={t("garage.trim")} value="Carrera S" />
        </dl>

        <div>
          <h3 className="text-sm font-semibold mb-1">{t("garage.story")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("landing.sampleStory")}</p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("garage.buildSheet")}</h3>
          <ul className="space-y-2">
            {mods.map((mod) => (
              <li key={mod.name} className="rounded-xl border border-border/50 px-3 py-2.5">
                <p className="text-[11px] text-primary font-medium">{mod.category}</p>
                <p className="text-sm font-medium">{mod.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{mod.shop}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-sm mt-0.5">{value}</dd>
    </div>
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
  icon: typeof Bike;
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
