import { Building2, Car, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { formatHandle } from "@/lib/utils";

export default function LandingPage() {
  const { t } = useTranslation();
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["explore-vehicles"],
    queryFn: () => api.exploreVehicles(),
    staleTime: 60_000,
  });

  const showcase = vehicles.slice(0, 6);

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-8">
      <section className="text-center space-y-4 pt-4 sm:pt-8">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto" />
        <h1 className="text-3xl sm:text-4xl font-display tracking-wide">{t("appTitle")}</h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">{t("appSubtitle")}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link to="/auth?register=1">
            <Button size="lg">{t("landing.join")}</Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline">{t("login")}</Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Pillar icon={Car} title={t("landing.pillarPassportTitle")} body={t("landing.pillarPassportBody")} />
        <Pillar icon={Wrench} title={t("landing.pillarBuildTitle")} body={t("landing.pillarBuildBody")} />
        <Pillar icon={Building2} title={t("landing.pillarShopTitle")} body={t("landing.pillarShopBody")} />
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("landing.passportsTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("landing.passportsHint")}</p>
        </div>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : showcase.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("landing.passportsEmpty")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {showcase.map((v) => {
              const title = [v.year, v.make, v.model].filter(Boolean).join(" ");
              return (
                <Link
                  key={v.id}
                  to={`/vehicles/${v.id}`}
                  className="flex gap-3 glass-card rounded-2xl p-3 hover:shadow-glow transition-shadow"
                >
                  {v.thumbnail ? (
                    <img
                      src={mediaUrl(v.thumbnail)}
                      alt={title}
                      className="w-20 h-20 object-cover rounded-xl shrink-0"
                    />
                  ) : (
                    <VehiclePlaceholder className="w-20 h-20 rounded-xl shrink-0" iconClassName="w-8 h-8" />
                  )}
                  <div className="min-w-0 flex flex-col justify-center">
                    <p className="font-semibold text-sm leading-snug line-clamp-2">{v.nickname?.trim() || title}</p>
                    {v.nickname?.trim() ? (
                      <p className="text-xs text-muted-foreground truncate">{title}</p>
                    ) : null}
                    {v.has_mods ? (
                      <p className="text-xs text-primary mt-0.5 inline-flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        {t("garage.hasMods")}
                      </p>
                    ) : null}
                    {v.owner && (
                      <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1 truncate">
                        {formatHandle(v.owner)}
                        {v.owner.is_verified && <VerifiedBadge className="w-3.5 h-3.5" />}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
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
