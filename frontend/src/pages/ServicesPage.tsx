import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MapPin, Phone, Star, Wrench } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import ServicesSearchBar from "@/components/ServicesSearchBar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { BusinessPublic, BUSINESS_CATEGORIES, getBusinessProfilePath } from "@/lib/businessProfile";
import { cn } from "@/lib/utils";

export default function ServicesPage() {
  const { t } = useTranslation();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");

  const handleDebouncedSearch = useCallback((value: string) => {
    setDebouncedSearch(value);
  }, []);

  const queryKey = useMemo(() => ["services", category, debouncedSearch], [category, debouncedSearch]);

  const { data, isPending, isFetching, isError, error } = useQuery({
    queryKey,
    queryFn: () =>
      api.getServices({
        businessType: category || undefined,
        q: debouncedSearch || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const services = data ?? [];

  if (isPending && services.length === 0) return <ListPageSkeleton rows={3} />;

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-display tracking-wide">{t("services")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("servicesSubtitle")}</p>
      </div>

      <ServicesSearchBar onDebouncedChange={handleDebouncedSearch} />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors",
            !category ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          {t("workshops.allSpecialties")}
        </button>
        {BUSINESS_CATEGORIES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setCategory(type)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors",
              category === type ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"
            )}
          >
            {t(`businessCategories.${type}`)}
          </button>
        ))}
      </div>

      {isError ? (
        <EmptyState
          icon={Wrench}
          title={t("servicesLoadError")}
          description={error instanceof Error ? error.message : t("tryAgainLater")}
        />
      ) : services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={debouncedSearch || category ? t("servicesNoSearchResults") : t("noServices")}
          description={debouncedSearch || category ? t("servicesSearchEmpty") : t("servicesEmptyCta")}
          action={
            !debouncedSearch && !category ? (
              <Link to="/settings">
                <Button variant="outline" size="sm">{t("businessUpgrade")}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("grid gap-4 sm:grid-cols-2 transition-opacity", isFetching && "opacity-60")}>
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: BusinessPublic }) {
  const { t } = useTranslation();

  return (
    <Link
      to={getBusinessProfilePath(service.business_type, service.id)}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <Card className="h-full hover:shadow-glow transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar
              user={{
                id: service.id,
                full_name: service.full_name,
                profile_picture_url: service.profile_picture_url,
              }}
              size="lg"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold">{service.full_name}</h3>
                {service.is_verified && <VerifiedBadge className="w-4 h-4 shrink-0" />}
                {service.is_open_now != null && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full",
                      service.is_open_now ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {service.is_open_now ? t("businessProfile.openNow") : t("businessProfile.closedNow")}
                  </span>
                )}
              </div>
              {service.business_type && (
                <p className="text-xs text-primary mt-0.5">
                  {t(`businessCategories.${service.business_type}`, { defaultValue: service.business_type })}
                </p>
              )}
              {service.rating_avg != null && (
                <p className="text-xs flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {service.rating_avg} ({service.review_count ?? 0})
                </p>
              )}
              {service.business_description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{service.business_description}</p>
              )}
              {service.business_phone && (
                <p className="text-sm flex items-center gap-1 mt-2 text-muted-foreground" dir="ltr">
                  <Phone className="w-3 h-3 shrink-0" />
                  {service.business_phone}
                </p>
              )}
              {service.business_address && (
                <p className="text-sm flex items-center gap-1 mt-1 text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{service.business_address}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
