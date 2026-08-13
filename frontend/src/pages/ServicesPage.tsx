import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";

export default function ServicesPage() {
  const { t } = useTranslation();
  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: () => api.getServices(),
  });

  if (isLoading) return <ListPageSkeleton rows={3} />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display tracking-wide">{t("services")}</h1>
      {services.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={t("noServices")}
          description={t("servicesEmptyCta")}
          action={<Link to="/settings"><Button variant="outline" size="sm">{t("businessUpgrade")}</Button></Link>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <Card key={service.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{service.full_name}</h3>
                    {service.business_type && (
                      <p className="text-xs text-primary mt-0.5">{service.business_type}</p>
                    )}
                    {service.business_description && (
                      <p className="text-sm text-muted-foreground mt-2">{service.business_description}</p>
                    )}
                    {service.business_phone && (
                      <p className="text-sm flex items-center gap-1 mt-2 text-muted-foreground">
                        <Phone className="w-3 h-3" /> {service.business_phone}
                      </p>
                    )}
                    {service.business_address && (
                      <p className="text-sm flex items-center gap-1 mt-1 text-muted-foreground">
                        <MapPin className="w-3 h-3" /> {service.business_address}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
