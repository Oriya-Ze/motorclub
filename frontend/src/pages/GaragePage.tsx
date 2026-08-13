import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Plus, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import VehicleDetailModal from "@/components/VehicleDetailModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { CardGridSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { api, Vehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

export default function GaragePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({
    make: "", model: "", year: "", color: "", engine: "", description: "", mods: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["garage"],
    queryFn: () => api.getMyGarage(),
  });

  const createVehicle = useMutation({
    mutationFn: () =>
      api.createVehicle({
        make: form.make,
        model: form.model,
        year: form.year ? parseInt(form.year) : undefined,
        color: form.color || undefined,
        engine: form.engine || undefined,
        description: form.description || undefined,
        mods: form.mods || undefined,
        image_urls: images.length ? images : undefined,
        is_primary: vehicles.length === 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      setShowForm(false);
      setForm({ make: "", model: "", year: "", color: "", engine: "", description: "", mods: "" });
      setImages([]);
      toast.success(t("garage.added"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleImageUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const results = await api.uploadMediaFiles(Array.from(files), "vehicle");
      setImages((prev) => [...prev, ...results.map((r) => r.reference)]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("garage.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("garage.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 ml-1" />
          {t("garage.add")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder={t("garage.make")} value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
              <Input placeholder={t("garage.model")} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <Input placeholder={t("garage.year")} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} dir="ltr" />
              <Input placeholder={t("garage.color")} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <Input placeholder={t("garage.engine")} value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} />
            <textarea
              placeholder={t("garage.description")}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm resize-none"
            />
            <textarea
              placeholder={t("garage.mods")}
              value={form.mods}
              onChange={(e) => setForm({ ...form, mods: e.target.value })}
              rows={2}
              className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm resize-none"
            />
            <Input type="file" accept="image/*" multiple onChange={(e) => handleImageUpload(e.target.files)} className="text-sm" disabled={uploading} />
            {images.length > 0 && (
              <div className="flex gap-2">
                {images.map((url, i) => (
                  <img key={i} src={mediaUrl(url)} alt="" className="w-16 h-16 object-cover rounded-lg" />
                ))}
              </div>
            )}
            <Button
              className="w-full"
              disabled={!form.make || !form.model || createVehicle.isPending || uploading}
              onClick={() => createVehicle.mutate()}
            >
              {t("garage.save")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <CardGridSkeleton count={2} />
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Car className="w-16 h-16 text-muted-foreground mx-auto opacity-40" />
          <p className="text-muted-foreground">{t("garage.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {vehicles.map((v: Vehicle) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelected(v)}
              className="text-start rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Card className="overflow-hidden hover:shadow-glow transition-shadow h-full cursor-pointer">
                {v.image_urls?.[0] ? (
                  <img src={mediaUrl(v.image_urls[0])} alt="" className="w-full h-40 object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-40 gradient-primary opacity-20" />
                )}
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-lg">
                        {v.year && `${v.year} `}{v.make} {v.model}
                        {v.is_primary && <Star className="w-4 h-4 inline text-primary mr-1 fill-primary" />}
                      </h3>
                      {v.color && <p className="text-sm text-muted-foreground">{v.color}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <VehicleDetailModal
          vehicle={selected}
          onClose={() => setSelected(null)}
          editable
        />
      )}
    </div>
  );
}
