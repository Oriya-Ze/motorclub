import { Bike, Building2, ChevronDown, ChevronLeft, ShoppingBag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import VehicleImageCarousel from "@/components/VehicleImageCarousel";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import { buttonClassName } from "@/components/ui/Button";
import { api, type ExploreVehicle } from "@/lib/api";
import { LANDING_SHOWCASE_IDS, selectLandingShowcase } from "@/lib/landingShowcase";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const DEMO_PHOTOS = [
  "/landing/landing-911-hero.jpg",
  "/landing/landing-911-rear.jpg",
  "/landing/landing-911-detail.jpg",
];

function vehicleTitle(vehicle: ExploreVehicle): string {
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

export default function LandingPage() {
  const { t } = useTranslation();
  const { data: vehicles = [], isLoading, isError } = useQuery({
    queryKey: ["explore-vehicles"],
    queryFn: () => api.exploreVehicles(),
    enabled: LANDING_SHOWCASE_IDS.length > 0,
    staleTime: 60_000,
    retry: 1,
  });

  const showcase = isError ? [] : selectLandingShowcase(vehicles);
  const showCommunity = showcase.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      <section className="text-center space-y-3 pt-2 sm:pt-4">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto" />
        <h1 className="text-3xl sm:text-4xl font-display tracking-wide">{t("landing.heroTitle")}</h1>
        <p className="text-foreground/80 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">{t("landing.heroBody")}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link to="/auth?register=1" className={buttonClassName({ size: "lg" })}>
            {t("landing.join")}
          </Link>
          <a
            href={showCommunity ? "#landing-cars" : "#landing-sample"}
            className={buttonClassName({ size: "lg", variant: "outline" })}
          >
            {showCommunity ? t("landing.discover") : t("landing.seeHow")}
          </a>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Pillar icon={Bike} title={t("landing.pillarStoryTitle")} body={t("landing.pillarStoryBody")}>
          <TextLink href="#landing-sample">{t("landing.pillarStoryLink")}</TextLink>
        </Pillar>
        <Pillar icon={ShoppingBag} title={t("landing.pillarPartsTitle")} body={t("landing.pillarPartsBody")}>
          <TextLink to="/marketplace">{t("landing.pillarPartsLink")}</TextLink>
          <p className="text-xs text-foreground/70">{t("landing.loginRequired")}</p>
        </Pillar>
        <Pillar icon={Building2} title={t("landing.pillarServicesTitle")} body={t("landing.pillarServicesBody")}>
          <TextLink to="/services">{t("landing.pillarServicesLink")}</TextLink>
          <p className="text-xs text-foreground/70">{t("landing.loginRequired")}</p>
        </Pillar>
      </section>
      <p className="text-sm text-foreground/75 text-center -mt-3">
        {t("landing.ownerActions")}{" "}
        <Link to="/marketplace?create=1" className="text-foreground/80 underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          {t("landing.ownerPublishParts")}
        </Link>
        {" · "}
        <Link to="/settings?upgrade=1" className="text-foreground/80 underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          {t("landing.ownerShowBusiness")}
        </Link>
      </p>

      <SamplePassport />

      {LANDING_SHOWCASE_IDS.length > 0 && isLoading ? (
        <section id="landing-cars" className="space-y-3 scroll-mt-24" aria-busy="true">
          <div className="h-6 w-40 rounded-lg bg-muted/40 animate-pulse" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        </section>
      ) : showCommunity ? (
        <section id="landing-cars" className="space-y-3 scroll-mt-24">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">{t("landing.passportsTitle")}</h2>
            <p className="text-sm text-foreground/75">{t("landing.passportsHint")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {showcase.map((vehicle) => (
              <CommunityVehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-border/50 bg-card/40 px-5 py-8 text-center space-y-3">
        <h2 className="text-2xl font-display tracking-wide">{t("landing.closeTitle")}</h2>
        <p className="text-foreground/80">{t("landing.closeBody")}</p>
        <div className="flex flex-col items-center gap-3 pt-1">
          <Link to="/auth?register=1" className={buttonClassName({ size: "lg" })}>
            {t("landing.join")}
          </Link>
          <Link to="/auth" className="text-sm text-foreground/75 underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
            {t("login")}
          </Link>
        </div>
      </section>

      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-4 text-sm text-foreground/70 border-t border-border/50">
        <Link to="/privacy-policy" className="hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">{t("privacyPolicy")}</Link>
        <Link to="/terms-of-service" className="hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">{t("termsOfService")}</Link>
        <a href="mailto:legal@motorclub.co.il" className="hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">{t("landing.contact")}</a>
      </footer>
    </div>
  );
}

function SamplePassport() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const photoAlts = [t("landing.sampleAltHero"), t("landing.sampleAltRear"), t("landing.sampleAltDetail")];

  const toggle = () => {
    setOpen((current) => {
      const next = !current;
      if (!next && sectionRef.current) {
        const top = sectionRef.current.getBoundingClientRect().top;
        if (top < 64) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          sectionRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }
      }
      return next;
    });
  };

  return (
    <section
      id="landing-sample"
      ref={sectionRef}
      aria-labelledby="landing-sample-title"
      className="glass-card rounded-3xl overflow-hidden scroll-mt-24"
    >
      <VehicleImageCarousel
        urls={DEMO_PHOTOS}
        className="rounded-none"
        imageClassName="rounded-none h-56 sm:h-80"
        alt={t("landing.sampleNickname")}
        alts={photoAlts}
      />
      <div className="p-4 sm:p-5 space-y-4">
        <div className="space-y-2">
          <p id="landing-sample-title" className="text-sm font-medium text-primary">
            {t("landing.sampleLabel")}
          </p>
          <p className="text-sm text-foreground/80">{t("landing.sampleDisclaimer")}</p>
          <h2 className="text-xl sm:text-2xl font-display tracking-wide">{t("landing.sampleNickname")}</h2>
          <p className="text-sm text-foreground/75">
            {t("landing.sampleYearMake")} <bdi>{t("landing.sampleModel")}</bdi>
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-1">{t("garage.story")}</h3>
          <p className="text-base text-foreground/85 leading-relaxed">{t("landing.sampleStory")}</p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 space-y-2">
          <p className="text-sm font-medium text-primary">{t("garage.modCategory.engine")}</p>
          <p className="text-base font-semibold">{t("landing.sampleModExhaust")}</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{t("landing.sampleModNote")}</p>
          <p className="text-sm text-foreground/75">{t("landing.sampleShopLine")}</p>
        </div>

        <button
          type="button"
          className={buttonClassName({ variant: "outline", size: "sm", className: "gap-1.5" })}
          aria-expanded={open}
          aria-controls="landing-sample-details"
          onClick={toggle}
        >
          {open ? t("landing.hideSampleDetails") : t("landing.showSampleDetails")}
          <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>

        {open && (
          <div id="landing-sample-details" className="space-y-4">
            <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <ChainStep label={t("landing.chainVehicle")} value={t("landing.sampleNickname")} />
              <ChainArrow />
              <ChainStep label={t("landing.chainMod")} value={t("landing.sampleModExhaust")} />
              <ChainArrow />
              <ChainStep label={t("landing.chainShop")} value={t("landing.sampleShopExhaust")} />
              <ChainArrow />
              <ChainStep label={t("landing.chainWorks")} value={t("landing.moreWork1")} />
            </ol>
            <p className="text-sm text-foreground/75">{t("landing.moreWorkHint")}</p>

            <dl className="grid grid-cols-2 gap-2">
              <SpecItem label={t("garage.year")} value="2023" />
              <SpecItem label={t("garage.color")} value={t("landing.sampleColor")} />
              <SpecItem label={t("garage.engine")} value={t("landing.sampleEngine")} />
              <SpecItem label={t("garage.trim")} value={t("landing.sampleTrim")} />
            </dl>

            <ul className="space-y-2">
              <li className="rounded-xl border border-border/50 px-3 py-2.5">
                <p className="text-sm font-medium text-primary">{t("garage.modCategory.suspension")}</p>
                <p className="text-sm font-medium">{t("landing.sampleModSuspension")}</p>
                <p className="text-sm text-foreground/75 mt-0.5">{t("landing.sampleShopSuspension")}</p>
              </li>
              <li className="rounded-xl border border-border/50 px-3 py-2.5">
                <p className="text-sm font-medium text-primary">{t("garage.modCategory.exterior")}</p>
                <p className="text-sm font-medium">{t("landing.sampleModDetail")}</p>
                <p className="text-sm text-foreground/75 mt-0.5">{t("landing.sampleShopDetail")}</p>
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function ChainArrow() {
  return (
    <li className="list-none flex items-center justify-center text-foreground/60" aria-hidden>
      <ChevronDown className="w-4 h-4 sm:hidden" />
      <ChevronLeft className="w-4 h-4 hidden sm:block ltr:rotate-180" />
    </li>
  );
}

function ChainStep({ label, value }: { label: string; value: string }) {
  return (
    <li className="min-w-0 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
      <p className="text-xs text-foreground/70">{label}</p>
      <p className="text-sm font-medium leading-snug"><bdi>{value}</bdi></p>
    </li>
  );
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
      <dt className="text-xs text-foreground/70">{label}</dt>
      <dd className="font-medium text-sm mt-0.5"><bdi>{value}</bdi></dd>
    </div>
  );
}

function CommunityVehicleCard({ vehicle }: { vehicle: ExploreVehicle }) {
  const { t } = useTranslation();
  const title = vehicleTitle(vehicle);
  const displayName = vehicle.nickname?.trim() || title;
  const preview = vehicle.mod_preview;

  return (
    <Link
      to={`/vehicles/${vehicle.id}`}
      className="flex gap-3 glass-card rounded-2xl p-3 hover:shadow-glow transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {vehicle.thumbnail ? (
        <img
          src={mediaUrl(vehicle.thumbnail)}
          alt={title}
          className="w-20 h-20 object-cover rounded-xl shrink-0"
          loading="lazy"
        />
      ) : (
        <VehiclePlaceholder className="w-20 h-20 rounded-xl shrink-0" iconClassName="w-8 h-8" />
      )}
      <div className="min-w-0 flex flex-col justify-center">
        <p className="font-semibold text-sm leading-snug line-clamp-2">{displayName}</p>
        {vehicle.nickname?.trim() ? (
          <p className="text-xs text-foreground/70 truncate">{title}</p>
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
  children,
}: {
  icon: typeof Bike;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-3 sm:p-4 space-y-1.5">
      <Icon className="w-5 h-5 text-primary" aria-hidden />
      <h2 className="font-semibold text-base">{title}</h2>
      <p className="text-sm text-foreground/80 leading-relaxed">{body}</p>
      {children ? <div className="flex flex-col items-start gap-1 pt-1">{children}</div> : null}
    </div>
  );
}

function TextLink({ to, href, children }: { to?: string; href?: string; children: ReactNode }) {
  const className = "inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md";
  if (href) {
    return <a href={href} className={className}>{children}</a>;
  }
  return <Link to={to ?? "/"} className={className}>{children}</Link>;
}
