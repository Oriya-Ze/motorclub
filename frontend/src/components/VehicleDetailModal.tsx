import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, PenLine, Star, Trash2, Wrench, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import VehicleImageCarousel from "@/components/VehicleImageCarousel";
import { Button } from "@/components/ui/Button";
import { api, Vehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface VehicleDetailModalProps {
  vehicle: Vehicle;
  onClose: () => void;
  editable?: boolean;
  onCreatePost?: (vehicleId: string) => void;
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-sm mt-0.5">{value}</dd>
    </div>
  );
}

export default function VehicleDetailModal({
  vehicle,
  onClose,
  editable = false,
  onCreatePost,
}: VehicleDetailModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: linkedPosts = [] } = useQuery({
    queryKey: ["vehicle-posts", vehicle.id],
    queryFn: () => api.getPosts({ vehicleId: vehicle.id, limit: 6 }),
  });

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

  const photoCount = vehicle.image_urls?.length ?? 0;
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] flex flex-col bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-glow overflow-hidden">
        <div className="shrink-0 flex items-start justify-between gap-3 p-4 border-b border-border/50">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-display tracking-wide truncate">{title}</h2>
              {vehicle.is_primary && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                  <Star className="w-3 h-3 fill-primary" />
                  {t("garage.primaryBadge")}
                </span>
              )}
            </div>
            {vehicle.trim && <p className="text-sm text-muted-foreground mt-0.5">{vehicle.trim}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground shrink-0 p-1"
            aria-label={t("garage.closeDetails")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 space-y-4">
            <VehicleImageCarousel urls={vehicle.image_urls ?? []} />

            <div className="flex flex-wrap gap-2 text-xs">
              {photoCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  <Camera className="w-3.5 h-3.5" />
                  {t("garage.photoCount", { count: photoCount })}
                </span>
              )}
              {vehicle.mods && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  <Wrench className="w-3.5 h-3.5" />
                  {t("garage.hasMods")}
                </span>
              )}
            </div>

            {(vehicle.color || vehicle.engine || vehicle.year) && (
              <dl className="grid grid-cols-2 gap-2">
                {vehicle.year && <SpecItem label={t("garage.year")} value={String(vehicle.year)} />}
                {vehicle.color && <SpecItem label={t("garage.color")} value={vehicle.color} />}
                {vehicle.engine && <SpecItem label={t("garage.engine")} value={vehicle.engine} />}
              </dl>
            )}

            {vehicle.description && (
              <div>
                <h3 className="text-sm font-semibold mb-1">{t("garage.description")}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vehicle.description}</p>
              </div>
            )}

            {vehicle.mods && (
              <div>
                <h3 className="text-sm font-semibold mb-1">{t("garage.mods")}</h3>
                <p className="text-sm whitespace-pre-wrap">{vehicle.mods}</p>
              </div>
            )}

            {linkedPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">{t("garage.linkedPosts")}</h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {linkedPosts.map((post) => {
                    const thumb = post.image_urls?.[0];
                    return (
                      <Link
                        key={post.id}
                        to={`/posts/${post.id}`}
                        onClick={onClose}
                        className="aspect-square rounded-lg overflow-hidden bg-asphalt block hover:opacity-90 transition-opacity"
                      >
                        {thumb ? (
                          <img src={mediaUrl(thumb)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-2 text-[10px] text-muted-foreground text-center line-clamp-4">
                            {post.content}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {editable && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    onClose();
                    if (onCreatePost) onCreatePost(vehicle.id);
                    else navigate("/", { state: { openCreatePost: true, vehicleId: vehicle.id } });
                  }}
                >
                  <PenLine className="w-4 h-4" />
                  {t("garage.postAbout")}
                </Button>
                {!vehicle.is_primary && (
                  <Button size="sm" variant="outline" onClick={() => setPrimary.mutate()} disabled={setPrimary.isPending}>
                    <Star className="w-4 h-4 ml-1" />
                    {t("garage.setPrimary")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("text-destructive hover:text-destructive")}
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
    </div>
  );
}
