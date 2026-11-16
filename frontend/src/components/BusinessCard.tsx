import { MapPin, Phone, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { BusinessPublic, getBusinessProfilePath } from "@/lib/businessProfile";
import { businessTypesOf } from "@/lib/businessTypes";
import { withReturnTo } from "@/lib/returnTo";
import { cn } from "@/lib/utils";

/** A business in a directory: the services page and the businesses tab in Explore. */
export default function BusinessCard({ service }: { service: BusinessPublic }) {
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <Link
      to={withReturnTo(getBusinessProfilePath(service.business_type, service.id), `${location.pathname}${location.search}`)}
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
              {businessTypesOf(service).length > 0 && (
                <p className="text-xs text-primary mt-0.5">
                  {businessTypesOf(service).map((type) => t(`businessCategories.${type}`, { defaultValue: type })).join(" · ")}
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
