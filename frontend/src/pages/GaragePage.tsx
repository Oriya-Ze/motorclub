import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { api, Vehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

export default function GaragePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    make: "", model: "", year: "", color: "", engine: "", description: "", mods: "",
  });
  const [images, setImages] = useState<string[]>([]);

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

  const deleteVehicle = useMutation({
    mutationFn: (id: string) => api.deleteVehicle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["garage"] }),
  });

  const handleImageUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const result = await api.uploadFiles(Array.from(files));
    setImages((prev) => [...prev, ...result.files.map((f) => f.url)]);
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
            <Input type="file" accept="image/*" multiple onChange={(e) => handleImageUpload(e.target.files)} className="text-sm" />
            {images.length > 0 && (
              <div className="flex gap-2">
                {images.map((url, i) => (
                  <img key={i} src={mediaUrl(url)} alt="" className="w-16 h-16 object-cover rounded-lg" />
                ))}
              </div>
            )}
            <Button
              className="w-full"
              disabled={!form.make || !form.model || createVehicle.isPending}
              onClick={() => createVehicle.mutate()}
            >
              {t("garage.save")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">...</p>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Car className="w-16 h-16 text-muted-foreground mx-auto opacity-40" />
          <p className="text-muted-foreground">{t("garage.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {vehicles.map((v: Vehicle) => (
            <Card key={v.id} className="overflow-hidden">
              {v.image_urls?.[0] ? (
                <img src={mediaUrl(v.image_urls[0])} alt="" className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 gradient-primary opacity-20" />
              )}
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg">
                      {v.year && `${v.year} `}{v.make} {v.model}
                      {v.is_primary && <Star className="w-4 h-4 inline text-primary mr-1 fill-primary" />}
                    </h3>
                    {v.trim && <p className="text-sm text-muted-foreground">{v.trim}</p>}
                    {v.engine && <p className="text-xs text-muted-foreground mt-1">{v.engine}</p>}
                  </div>
                  <button onClick={() => deleteVehicle.mutate(v.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {v.mods && <p className="text-sm mt-2 text-muted-foreground">{v.mods}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
