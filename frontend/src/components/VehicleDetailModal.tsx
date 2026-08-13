import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { api, Vehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

interface VehicleDetailModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  editable?: boolean;
}

export default function VehicleDetailModal({ vehicle, onClose, editable = false }: VehicleDetailModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const deleteVehicle = useMutation({
    mutationFn: () => api.deleteVehicle(vehicle.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      toast.success(t("garage.deleted"));
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setPrimary = useMutation({
    mutationFn: () => api.updateVehicle(vehicle.id, { is_primary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      toast.success(t("garage.primarySet"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-glow">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/50 bg-card/95 backdrop-blur">
          <h2 className="text-lg font-bold">
            {vehicle.year && `${vehicle.year} `}{vehicle.make} {vehicle.model}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label={t("garage.closeDetails")}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {vehicle.image_urls?.length ? (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {vehicle.image_urls.map((url, i) => (
                <img key={i} src={mediaUrl(url)} alt="" className="w-full max-w-sm h-48 object-cover rounded-xl shrink-0" />
              ))}
            </div>
          ) : (
            <div className="w-full h-48 rounded-xl gradient-primary opacity-20" />
          )}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            {vehicle.color && (
              <div>
                <dt className="text-muted-foreground">{t("garage.color")}</dt>
                <dd className="font-medium">{vehicle.color}</dd>
              </div>
            )}
            {vehicle.engine && (
              <div>
                <dt className="text-muted-foreground">{t("garage.engine")}</dt>
                <dd className="font-medium">{vehicle.engine}</dd>
              </div>
            )}
          </dl>

          {vehicle.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vehicle.description}</p>
          )}
          {vehicle.mods && (
            <p className="text-sm whitespace-pre-wrap">
              <span className="font-medium">{t("garage.mods")}: </span>
              {vehicle.mods}
            </p>
          )}

          {editable && (
            <div className="flex flex-wrap gap-2 pt-2">
              {!vehicle.is_primary && (
                <Button size="sm" variant="outline" onClick={() => setPrimary.mutate()} disabled={setPrimary.isPending}>
                  <Star className="w-4 h-4 ml-1" />
                  {t("garage.setPrimary")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteVehicle.mutate()}
                disabled={deleteVehicle.isPending}
              >
                <Trash2 className="w-4 h-4 ml-1" />
                {t("garage.delete")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
