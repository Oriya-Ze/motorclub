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

const HERO_PHOTO = "/landing/landing-911-hero.jpg";

// The hero already shows the front, so the sample passport opens on the rear.
const DEMO_PHOTOS = [
  "/landing/landing-911-rear.jpg",
  "/landing/landing-911-detail.jpg",
  HERO_PHOTO,
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
    <div className="max-w-6xl mx-auto space-y-12 sm:space-y-16 pb-8">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-black text-white md:flex md:min-h-[36rem] md:items-center">
        <div className="relative h-72 sm:h-96 md:absolute md:inset-0 md:h-full">
          <img
            src={HERO_PHOTO}
            alt=""
            className="h-full w-full object-cover md:object-[35%_50%]"
            fetchPriority="high"
            decoding="async"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent md:bg-gradient-to-l md:from-black md:via-black/45 md:to-transparent ltr:md:bg-gradient-to-r" />
          <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-t from-black/80 via-transparent to-transparent md:block" />
          <SpeedStreaks />
        </div>
        <Tachometer className="absolute top-3 end-3 w-28 sm:w-32 md:top-auto md:bottom-6 md:end-6 md:w-44" />

        <div className="relative z-10 -mt-24 space-y-4 px-5 pb-7 sm:px-8 md:mt-0 md:max-w-xl md:space-y-5 md:px-12 md:py-16">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm sm:text-sm">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {t("landing.heroEyebrow")}
          </p>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">{t("landing.heroTitle")}</h1>
          <p className="max-w-lg text-base leading-relaxed text-white/80 sm:text-lg">{t("landing.heroBody")}</p>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
            <Link to="/auth?register=1" className={buttonClassName({ size: "lg", className: "justify-center" })}>
              {t("landing.join")}
            </Link>
            <a
              href={showCommunity ? "#landing-cars" : "#landing-sample"}
              className={buttonClassName({ size: "lg", variant: "outline", className: "justify-center border-white/25 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15" })}
            >
              {showCommunity ? t("landing.discover") : t("landing.seeHow")}
            </a>
          </div>
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="landing-pillars-title">
        <SectionHeading id="landing-pillars-title" title={t("landing.pillarsTitle")} />
        <div className="grid gap-4 md:grid-cols-3">
          <Pillar index={1} icon={Bike} title={t("landing.pillarStoryTitle")} body={t("landing.pillarStoryBody")}>
            <TextLink href="#landing-sample">{t("landing.pillarStoryLink")}</TextLink>
          </Pillar>
          <Pillar index={2} icon={ShoppingBag} title={t("landing.pillarPartsTitle")} body={t("landing.pillarPartsBody")}>
            <TextLink to="/marketplace">{t("landing.pillarPartsLink")}</TextLink>
            <p className="text-xs text-foreground/70">{t("landing.loginRequired")}</p>
          </Pillar>
          <Pillar index={3} icon={Building2} title={t("landing.pillarServicesTitle")} body={t("landing.pillarServicesBody")}>
            <TextLink to="/services">{t("landing.pillarServicesLink")}</TextLink>
            <p className="text-xs text-foreground/70">{t("landing.loginRequired")}</p>
            <p className="mt-2 w-full border-t border-border/50 pt-3 text-sm text-foreground/80">
              {t("landing.ownerActions")}{" "}
              <Link to="/settings?upgrade=1" className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                {t("landing.ownerShowBusiness")}
              </Link>
            </p>
          </Pillar>
        </div>
      </section>

      <section className="space-y-6" aria-labelledby="landing-sample-section-title">
        <SectionHeading id="landing-sample-section-title" title={t("landing.sampleSectionTitle")} body={t("landing.sampleSectionBody")} />
        <SamplePassport />
      </section>

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

      <section className="relative isolate overflow-hidden rounded-[2rem] border border-primary/25 bg-card/60 px-5 pb-10 pt-16 text-center sm:pb-14 sm:pt-20">
        <div aria-hidden className="landing-checker absolute inset-x-0 top-0 -z-10 h-24" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.28),transparent_65%)]" />
        <div className="mx-auto max-w-xl space-y-3">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.closeTitle")}</h2>
          <div aria-hidden className="landing-road mx-auto h-1 w-40 rounded-full" />
          <p className="text-foreground/80 sm:text-lg">{t("landing.closeBody")}</p>
        </div>
        <div className="flex flex-col items-center gap-3 pt-6">
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
  const photoAlts = [t("landing.sampleAltRear"), t("landing.sampleAltDetail"), t("landing.sampleAltHero")];

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
      className="glass-card relative rounded-3xl overflow-hidden scroll-mt-24 lg:grid lg:grid-cols-2 lg:items-start"
    >
      <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-l from-primary via-primary/60 to-transparent" />
      <VehicleImageCarousel
        urls={DEMO_PHOTOS}
        className="rounded-none"
        imageClassName="rounded-none h-56 sm:h-80 lg:h-[30rem]"
        alt={t("landing.sampleNickname")}
        alts={photoAlts}
      />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="space-y-2">
          <p id="landing-sample-title" className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {t("landing.sampleLabel")}
          </p>
          <p className="text-sm text-foreground/80">{t("landing.sampleDisclaimer")}</p>
          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("landing.sampleNickname")}</h3>
          <p className="text-sm text-foreground/75">
            {t("landing.sampleYearMake")} <bdi>{t("landing.sampleModel")}</bdi>
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-1">{t("garage.story")}</h4>
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
  index,
  icon: Icon,
  title,
  body,
  children,
}: {
  index: number;
  icon: typeof Bike;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="group relative isolate overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-5 space-y-2 transition duration-300 hover:border-primary/40 hover:shadow-glow motion-safe:hover:-translate-y-1">
      <div aria-hidden className="pointer-events-none absolute -top-20 -end-20 -z-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl opacity-40 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex items-start justify-between pb-1">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-glow">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span aria-hidden className="font-display text-4xl leading-none text-foreground/10">{String(index).padStart(2, "0")}</span>
      </div>
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm text-foreground/80 leading-relaxed">{body}</p>
      {children ? <div className="flex flex-col items-start gap-1 pt-1">{children}</div> : null}
    </div>
  );
}

function SectionHeading({ id, title, body }: { id: string; title: string; body?: string }) {
  return (
    <div className="space-y-3 text-center">
      <h2 id={id} className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <div aria-hidden className="landing-road mx-auto h-1 w-32 rounded-full" />
      {body ? <p className="mx-auto max-w-xl text-foreground/75">{body}</p> : null}
    </div>
  );
}

/**
 * Thin light streaks over the car, away from the text, for a sense of speed. Drawn for RTL (the car is on
 * the left) and mirrored for LTR. Hidden on phones and with reduced motion.
 */
function SpeedStreaks() {
  const streaks = [
    { top: "24%", width: "20%", delay: "0s" },
    { top: "44%", width: "16%", delay: "1.3s" },
    { top: "66%", width: "26%", delay: "0.6s" },
    { top: "80%", width: "18%", delay: "2s" },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block ltr:-scale-x-100">
      {streaks.map((streak) => (
        <span
          key={streak.top}
          className="landing-streak absolute h-px bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-0"
          style={{ top: streak.top, left: "28%", width: streak.width, animationDelay: streak.delay }}
        />
      ))}
    </div>
  );
}

const GAUGE = { cx: 100, cy: 100, r: 78 };

function gaugePoint(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: GAUGE.cx + radius * Math.sin(rad), y: GAUGE.cy - radius * Math.cos(rad) };
}

function gaugeArc(from: number, to: number, radius: number) {
  const start = gaugePoint(from, radius);
  const end = gaugePoint(to, radius);
  const large = to - from > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

/** A decorative rev counter whose needle revs up once when the page opens. */
function Tachometer({ className }: { className?: string }) {
  // 0 to 8 thousand RPM over 240 degrees, red line from 6.5.
  const angleFor = (rpm: number) => -120 + rpm * 30;
  return (
    <div aria-hidden className={cn("pointer-events-none z-10 rounded-2xl border border-white/10 bg-black/55 p-2 backdrop-blur-md", className)}>
      <svg viewBox="0 0 200 150" className="block w-full" style={{ direction: "ltr" }}>
        <path d={gaugeArc(-120, 120, GAUGE.r)} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="8" strokeLinecap="round" />
        <path d={gaugeArc(angleFor(6.5), 120, GAUGE.r)} fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round" />
        {Array.from({ length: 17 }, (_, i) => {
          const rpm = i / 2;
          const major = i % 2 === 0;
          const outer = gaugePoint(angleFor(rpm), GAUGE.r - 9);
          const inner = gaugePoint(angleFor(rpm), GAUGE.r - (major ? 19 : 14));
          return (
            <line
              key={i}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={rpm >= 6.5 ? "hsl(var(--primary))" : "rgba(255,255,255,0.65)"}
              strokeWidth={major ? 2.5 : 1.5}
              strokeLinecap="round"
            />
          );
        })}
        {Array.from({ length: 9 }, (_, rpm) => {
          const p = gaugePoint(angleFor(rpm), GAUGE.r - 32);
          return (
            <text key={rpm} x={p.x} y={p.y + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={rpm >= 7 ? "hsl(var(--primary))" : "rgba(255,255,255,0.75)"}>
              {rpm}
            </text>
          );
        })}
        <text x="100" y="147" textAnchor="middle" fontSize="9" letterSpacing="1.5" fill="rgba(255,255,255,0.55)">RPM ×1000</text>
        <g className="landing-needle">
          <line x1="100" y1="112" x2="100" y2="34" stroke="hsl(var(--primary))" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="8" fill="#111" stroke="hsl(var(--primary))" strokeWidth="2.5" />
      </svg>
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
