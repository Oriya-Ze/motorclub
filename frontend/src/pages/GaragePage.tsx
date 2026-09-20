import { useQuery } from "@tanstack/react-query";
import { Car, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import AddVehicleForm from "@/components/AddVehicleForm";
import EmptyState from "@/components/EmptyState";
import VehicleCard from "@/components/VehicleCard";
import { Button } from "@/components/ui/Button";
import { CardGridSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";

export default function GaragePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["garage"],
    queryFn: () => api.getMyGarage(),
  });

  useEffect(() => {
    const state = location.state as { vehicleId?: string } | null;
    if (!state?.vehicleId) return;
    navigate(`/vehicles/${state.vehicleId}`, { replace: true });
  }, [location.state, navigate]);

  const primary = vehicles.find((v) => v.is_primary);
  const others = vehicles.filter((v) => v.id !== primary?.id);

  return (
    <div className="space-y-6 pb-20 md:pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display tracking-wide">{t("garage.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("garage.subtitle")}</p>
          {vehicles.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{t("garage.vehicleCount", { count: vehicles.length })}</p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowForm((open) => !open)}>
          <Plus className="w-4 h-4 ml-1" />
          {t("garage.add")}
        </Button>
      </div>

      {showForm && (
        <AddVehicleForm
          existingCount={vehicles.length}
          onCreated={(vehicle) => {
            setShowForm(false);
            navigate(`/vehicles/${vehicle.id}`);
          }}
        />
      )}

      {isLoading ? (
        <CardGridSkeleton count={2} />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Car}
          title={t("garage.empty")}
          description={t("garage.emptyDesc")}
          action={
            <Button size="sm" onClick={() => setShowForm(true)}>
              {t("garage.add")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {primary && vehicles.length > 1 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">{t("garage.mainVehicle")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <VehicleCard vehicle={primary} featured showPrimary />
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {vehicles.length === 1 && primary
              ? <VehicleCard vehicle={primary} showPrimary />
              : others.map((v) => <VehicleCard key={v.id} vehicle={v} showPrimary />)}
          </div>
        </div>
      )}
    </div>
  );
}
