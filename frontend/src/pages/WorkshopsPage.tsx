import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Phone, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import PageHeading from "@/components/PageHeading";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { WORKSHOP_SPECIALTIES, type WorkshopBusiness } from "@/lib/workshops";
import { cn } from "@/lib/utils";

function specialtyLabel(t: (key: string) => string, type?: string | null) {
  if (!type || !WORKSHOP_SPECIALTIES.includes(type as (typeof WORKSHOP_SPECIALTIES)[number])) return null;
  return t(`workshops.specialty.${type}`);
}

export default function WorkshopsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");

  const queryKey = useMemo(() => ["workshops", specialty, search.trim()], [specialty, search]);

  const { data: workshops = [], isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      api.getWorkshops({
        specialty: specialty || undefined,
        q: search.trim() || undefined,
      }),
  });

  if (isLoading) return <ListPageSkeleton rows={4} />;

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <PageHeading subtitle={t("workshops.subtitle")}>{t("workshops.title")}</PageHeading>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("workshops.search")}
            className="ps-9"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => setSpecialty("")}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors",
            !specialty ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          {t("workshops.allSpecialties")}
        </button>
        {WORKSHOP_SPECIALTIES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSpecialty(type)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors",
              specialty === type ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"
            )}
          >
            {t(`workshops.specialty.${type}`)}
          </button>
        ))}
      </div>

      {workshops.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("workshops.empty")}
          description={t("workshops.emptyDesc")}
          action={
            <Link to="/settings">
              <Button variant="outline" size="sm">{t("workshops.registerCta")}</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workshops.map((workshop) => (
            <WorkshopCard key={workshop.id} workshop={workshop} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkshopCard({ workshop }: { workshop: WorkshopBusiness }) {
  const { t } = useTranslation();
  const label = specialtyLabel(t, workshop.business_type);

  return (
    <Link to={`/workshops/${workshop.id}`} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
      <Card className="h-full hover:shadow-glow transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar
              user={{
                id: workshop.id,
                full_name: workshop.full_name,
                profile_picture_url: workshop.profile_picture_url,
              }}
              size="lg"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold truncate">{workshop.full_name}</h3>
                {workshop.is_verified && <VerifiedBadge className="w-4 h-4 shrink-0" />}
                {workshop.is_open_now != null && (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                      workshop.is_open_now ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {workshop.is_open_now ? t("businessProfile.openNow") : t("businessProfile.closedNow")}
                  </span>
                )}
              </div>
              {label && <p className="text-xs text-primary mt-0.5">{label}</p>}
              {workshop.rating_avg != null && (
                <p className="text-xs flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {workshop.rating_avg} ({workshop.review_count ?? 0})
                </p>
              )}
              {workshop.business_description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{workshop.business_description}</p>
              )}
              {workshop.business_address && (
                <p className="text-xs flex items-center gap-1 mt-2 text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{workshop.business_address}</span>
                </p>
              )}
              {workshop.business_phone && (
                <p className="text-xs flex items-center gap-1 mt-1 text-muted-foreground" dir="ltr">
                  <Phone className="w-3 h-3 shrink-0" />
                  {workshop.business_phone}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-primary mt-4 font-medium">{t("workshops.viewProfile")} →</p>
        </CardContent>
      </Card>
    </Link>
  );
}
