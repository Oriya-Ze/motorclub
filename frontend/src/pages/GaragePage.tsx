import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import VehicleCard from "@/components/VehicleCard";
import VehicleModEditor from "@/components/VehicleModEditor";
import VehiclePhotoEditor from "@/components/VehiclePhotoEditor";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { CardGridSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { api, VehicleCatalogVariant, VehicleModItem } from "@/lib/api";

const emptyForm = {
  makeId: "",
  modelId: "",
  variantId: "",
  make: "",
  model: "",
  year: "",
  trim: "",
  color: "",
  engine: "",
  description: "",
  nickname: "",
  mods: [] as VehicleModItem[],
  manual: false,
};

export default function GaragePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<string[]>([]);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["garage"],
    queryFn: () => api.getMyGarage(),
  });

  const { data: catalogMakes = [], isLoading: makesLoading } = useQuery({
    queryKey: ["vehicle-catalog-makes"],
    queryFn: () => api.getVehicleCatalogMakes(),
    enabled: showForm && !form.manual,
    staleTime: 86_400_000,
  });

  const makeId = form.makeId || null;

  const { data: catalogModels = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["vehicle-catalog-models", makeId],
    queryFn: () => api.getVehicleCatalogModels(makeId!),
    enabled: showForm && !form.manual && Boolean(makeId),
    staleTime: 86_400_000,
  });

  const modelId = form.modelId || null;

  const { data: catalogVariants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["vehicle-catalog-variants", makeId, modelId],
    queryFn: () => api.getVehicleCatalogVariants(makeId!, modelId!),
    enabled: showForm && !form.manual && Boolean(makeId) && Boolean(modelId),
    staleTime: 86_400_000,
  });

  const applyVariant = (variant: VehicleCatalogVariant) => {
    const year =
      variant.year_from && variant.year_to && variant.year_from !== variant.year_to
        ? String(variant.year_to)
        : variant.year_to
          ? String(variant.year_to)
          : variant.year_from
            ? String(variant.year_from)
            : "";
    const extras = [
      variant.horsepower ? `${variant.horsepower}hp` : null,
      variant.fuel,
    ].filter(Boolean);
    const engine = [variant.engine, extras.length ? extras.join(" · ") : null].filter(Boolean).join(" · ");
    setForm((prev) => ({
      ...prev,
      variantId: variant.id,
      trim: variant.trim,
      engine,
      year: year || prev.year,
    }));
  };

  const variantLabel = (variant: VehicleCatalogVariant) => {
    const years =
      variant.year_from && variant.year_to
        ? variant.year_from === variant.year_to
          ? String(variant.year_from)
          : `${variant.year_from}–${variant.year_to}`
        : "";
    return years ? `${variant.trim} (${years})` : variant.trim;
  };

  useEffect(() => {
    const state = location.state as { vehicleId?: string } | null;
    if (!state?.vehicleId) return;
    navigate(`/vehicles/${state.vehicleId}`, { replace: true });
  }, [location.state, navigate]);

  const primary = vehicles.find((v) => v.is_primary);
  const others = vehicles.filter((v) => v.id !== primary?.id);
  const identityReady = Boolean(form.make.trim() && form.model.trim());

  const resetForm = () => {
    setForm(emptyForm);
    setImages([]);
    setStep(1);
    setShowForm(false);
  };

  const createVehicle = useMutation({
    mutationFn: () =>
      api.createVehicle({
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year ? parseInt(form.year, 10) : undefined,
        trim: form.trim || undefined,
        color: form.color || undefined,
        engine: form.engine || undefined,
        description: form.description || undefined,
        nickname: form.nickname.trim() || undefined,
        mod_items: form.mods.filter((item) => item.name.trim()),
        image_urls: images.length ? images : undefined,
        is_primary: vehicles.length === 0,
      }),
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      toast.success(t("garage.added"));
      resetForm();
      navigate(`/vehicles/${vehicle.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
        <Button
          size="sm"
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4 ml-1" />
          {t("garage.add")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-xs text-muted-foreground">{t("garage.addStep", { step, total: 2 })}</p>

            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.manual}
                    onChange={(e) =>
                      setForm({
                        ...emptyForm,
                        manual: e.target.checked,
                        color: form.color,
                        description: form.description,
                        nickname: form.nickname,
                        mods: form.mods,
                      })
                    }
                  />
                  {t("garage.notInCatalog")}
                </label>

                {form.manual ? (
                  <>
                    <Input
                      placeholder={t("garage.make")}
                      value={form.make}
                      onChange={(e) => setForm({ ...form, make: e.target.value })}
                    />
                    <Input
                      placeholder={t("garage.model")}
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                    />
                    <Input
                      placeholder={t("garage.trim")}
                      value={form.trim}
                      onChange={(e) => setForm({ ...form, trim: e.target.value })}
                    />
                    <Input
                      placeholder={t("garage.engine")}
                      value={form.engine}
                      onChange={(e) => setForm({ ...form, engine: e.target.value })}
                    />
                  </>
                ) : (
                  <>
                    <Select
                      value={form.makeId}
                      disabled={makesLoading}
                      onChange={(e) => {
                        const nextMakeId = e.target.value;
                        const make = catalogMakes.find((m) => m.id === nextMakeId)?.name ?? "";
                        setForm({
                          ...form,
                          makeId: nextMakeId,
                          make,
                          modelId: "",
                          variantId: "",
                          model: "",
                          trim: "",
                          engine: "",
                          year: "",
                        });
                      }}
                    >
                      <option value="">{makesLoading ? t("garage.loadingCatalog") : t("garage.selectMake")}</option>
                      {catalogMakes.map((make) => (
                        <option key={make.id} value={make.id}>
                          {make.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={form.modelId}
                      disabled={!form.makeId || modelsLoading}
                      onChange={(e) => {
                        const nextModelId = e.target.value;
                        const model = catalogModels.find((m) => m.id === nextModelId)?.name ?? "";
                        setForm({
                          ...form,
                          modelId: nextModelId,
                          model,
                          variantId: "",
                          trim: "",
                          engine: "",
                          year: "",
                        });
                      }}
                    >
                      <option value="">
                        {!form.makeId
                          ? t("garage.selectMakeFirst")
                          : modelsLoading
                            ? t("garage.loadingCatalog")
                            : t("garage.selectModel")}
                      </option>
                      {catalogModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={form.variantId}
                      disabled={!form.modelId || variantsLoading}
                      className="sm:col-span-2"
                      onChange={(e) => {
                        const variant = catalogVariants.find((v) => v.id === e.target.value);
                        if (variant) applyVariant(variant);
                        else setForm({ ...form, variantId: "", trim: "", engine: "" });
                      }}
                    >
                      <option value="">
                        {!form.modelId
                          ? t("garage.selectModelFirst")
                          : variantsLoading
                            ? t("garage.loadingCatalog")
                            : t("garage.selectVariantOptional")}
                      </option>
                      {catalogVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variantLabel(variant)}
                          {variant.engine ? ` — ${variant.engine}` : ""}
                        </option>
                      ))}
                    </Select>
                  </>
                )}

                <Input
                  placeholder={t("garage.year")}
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  dir="ltr"
                  inputMode="numeric"
                />
                <Input
                  placeholder={t("garage.color")}
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
                {!form.manual && (
                  <Input
                    placeholder={t("garage.engine")}
                    value={form.engine}
                    onChange={(e) => setForm({ ...form, engine: e.target.value })}
                    className="sm:col-span-2"
                  />
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <VehiclePhotoEditor urls={images} onChange={setImages} disabled={createVehicle.isPending} />
                <Input
                  placeholder={t("garage.nicknamePlaceholder")}
                  value={form.nickname}
                  maxLength={40}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground -mt-2">{t("garage.nicknameOptional")}</p>
                <textarea
                  placeholder={t("garage.storyPlaceholder")}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm resize-none"
                />
                <VehicleModEditor
                  items={form.mods}
                  onChange={(mods) => setForm({ ...form, mods })}
                  disabled={createVehicle.isPending}
                />
              </div>
            )}

            <div className="flex gap-2">
              {step === 2 && (
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  {t("garage.backStep")}
                </Button>
              )}
              {step === 1 ? (
                <Button className="flex-1" disabled={!identityReady} onClick={() => setStep(2)}>
                  {t("garage.nextStep")}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  disabled={!identityReady || createVehicle.isPending}
                  onClick={() => createVehicle.mutate()}
                >
                  {t("garage.save")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
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
