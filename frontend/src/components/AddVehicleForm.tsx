import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import VehicleModEditor from "@/components/VehicleModEditor";
import VehiclePhotoEditor from "@/components/VehiclePhotoEditor";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { api, Vehicle, VehicleCatalogVariant, VehicleModItem } from "@/lib/api";
import { formatEngineLabel } from "@/lib/formatLabels";

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

type Props = {
  existingCount: number;
  onCreated?: (vehicle: Vehicle) => void;
};

export default function AddVehicleForm({ existingCount, onCreated }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<string[]>([]);

  const { data: catalogMakes = [], isLoading: makesLoading } = useQuery({
    queryKey: ["vehicle-catalog-makes"],
    queryFn: () => api.getVehicleCatalogMakes(),
    enabled: !form.manual,
    staleTime: 86_400_000,
  });

  const makeId = form.makeId || null;

  const { data: catalogModels = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["vehicle-catalog-models", makeId],
    queryFn: () => api.getVehicleCatalogModels(makeId!),
    enabled: !form.manual && Boolean(makeId),
    staleTime: 86_400_000,
  });

  const modelId = form.modelId || null;

  const { data: catalogVariants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["vehicle-catalog-variants", makeId, modelId],
    queryFn: () => api.getVehicleCatalogVariants(makeId!, modelId!),
    enabled: !form.manual && Boolean(makeId) && Boolean(modelId),
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
    const extras = [variant.horsepower ? `${variant.horsepower} כ״ס` : null, variant.fuel].filter(Boolean);
    const engine = formatEngineLabel(variant.engine || extras.join(" · "));
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

  const identityReady = Boolean(form.make.trim() && form.model.trim());

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
        is_primary: existingCount === 0,
      }),
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      toast.success(t("garage.added"));
      setForm(emptyForm);
      setImages([]);
      setStep(1);
      onCreated?.(vehicle);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
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
  );
}
