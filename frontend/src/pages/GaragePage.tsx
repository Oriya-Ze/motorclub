import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Car, Plus, Star, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import VehicleDetailModal from "@/components/VehicleDetailModal";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { CardGridSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { api, Vehicle, VehicleCatalogVariant } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export default function GaragePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({
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
    mods: "",
  });
  const [images, setImages] = useState<string[]>([]);

  const imageUpload = useImageCropUpload({
    purpose: "vehicle",
    multiple: true,
    onUploaded: (result) => setImages((prev) => [...prev, result.reference]),
    onError: (err) => toast.error(err.message),
  });

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["garage"],
    queryFn: () => api.getMyGarage(),
  });

  const { data: catalogMakes = [], isLoading: makesLoading } = useQuery({
    queryKey: ["vehicle-catalog-makes"],
    queryFn: () => api.getVehicleCatalogMakes(),
    enabled: showForm,
    staleTime: 86_400_000,
  });

  const makeIdNum = form.makeId ? Number(form.makeId) : null;

  const { data: catalogModels = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["vehicle-catalog-models", makeIdNum],
    queryFn: () => api.getVehicleCatalogModels(makeIdNum!),
    enabled: showForm && makeIdNum !== null,
    staleTime: 86_400_000,
  });

  const modelIdNum = form.modelId ? Number(form.modelId) : null;

  const { data: catalogVariants = [], isLoading: variantsLoading } = useQuery({
    queryKey: ["vehicle-catalog-variants", makeIdNum, modelIdNum],
    queryFn: () => api.getVehicleCatalogVariants(makeIdNum!, modelIdNum!),
    enabled: showForm && makeIdNum !== null && modelIdNum !== null,
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
    setForm((prev) => ({
      ...prev,
      variantId: variant.id,
      trim: variant.trim,
      engine: variant.engine,
      year,
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
    if (!state?.vehicleId || !vehicles.length) return;
    const vehicle = vehicles.find((v) => v.id === state.vehicleId);
    if (vehicle) setSelected(vehicle);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, vehicles, navigate, location.pathname]);

  const primary = vehicles.find((v) => v.is_primary);
  const others = vehicles.filter((v) => v.id !== primary?.id);

  const createVehicle = useMutation({
    mutationFn: () =>
      api.createVehicle({
        make: form.make,
        model: form.model,
        year: form.year ? parseInt(form.year) : undefined,
        trim: form.trim || undefined,
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
      setForm({
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
        mods: "",
      });
      setImages([]);
      toast.success(t("garage.added"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleImageUpload = (files: FileList | null) => {
    imageUpload.handleSelect(files);
  };

  const handleCreatePost = (vehicleId: string) => {
    navigate("/", { state: { openCreatePost: true, vehicleId } });
  };

  const renderVehicleCard = (v: Vehicle, featured = false) => (
    <button
      key={v.id}
      type="button"
      onClick={() => setSelected(v)}
      className={cn(
        "text-start rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        featured && "sm:col-span-2"
      )}
    >
      <Card className="overflow-hidden hover:shadow-glow transition-shadow h-full cursor-pointer group">
        <div className="relative">
          {v.image_urls?.[0] ? (
            <img
              src={mediaUrl(v.image_urls[0])}
              alt=""
              className={cn("w-full object-cover", featured ? "h-52" : "h-40")}
              loading="lazy"
            />
          ) : (
            <VehiclePlaceholder className={featured ? "h-52" : "h-40"} />
          )}
          <div className="absolute top-2 start-2 flex flex-wrap gap-1.5">
            {v.is_primary && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                <Star className="w-3 h-3 fill-current" />
                {t("garage.primaryBadge")}
              </span>
            )}
            {(v.image_urls?.length ?? 0) > 1 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-black/55 text-white">
                <Camera className="w-3 h-3" />
                {v.image_urls!.length}
              </span>
            )}
          </div>
        </div>
        <CardContent className="pt-4">
          <h3 className={cn("font-bold", featured ? "text-xl" : "text-lg")}>
            {v.year && `${v.year} `}{v.make} {v.model}
          </h3>
          {v.trim && <p className="text-sm text-muted-foreground">{v.trim}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
            {v.color && <span>{v.color}</span>}
            {v.engine && <span>{v.engine}</span>}
            {v.mods && (
              <span className="inline-flex items-center gap-1 text-primary">
                <Wrench className="w-3 h-3" />
                {t("garage.hasMods")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </button>
  );

  return (
    <>
      {imageUpload.cropModal}
      <div className="space-y-6 pb-20 md:pb-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display tracking-wide">{t("garage.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("garage.subtitle")}</p>
          {vehicles.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{t("garage.vehicleCount", { count: vehicles.length })}</p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 ml-1" />
          {t("garage.add")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                value={form.makeId}
                disabled={makesLoading}
                onChange={(e) => {
                  const makeId = e.target.value;
                  const make = catalogMakes.find((m) => String(m.id) === makeId)?.name ?? "";
                  setForm({
                    ...form,
                    makeId,
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
                  const modelId = e.target.value;
                  const model = catalogModels.find((m) => String(m.id) === modelId)?.name ?? "";
                  setForm({
                    ...form,
                    modelId,
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
                }}
              >
                <option value="">
                  {!form.modelId
                    ? t("garage.selectModelFirst")
                    : variantsLoading
                      ? t("garage.loadingCatalog")
                      : t("garage.selectVariant")}
                </option>
                {catalogVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variantLabel(variant)}
                    {variant.engine ? ` — ${variant.engine}` : ""}
                  </option>
                ))}
              </Select>

              <Input
                placeholder={t("garage.year")}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                dir="ltr"
              />
              <Input
                placeholder={t("garage.color")}
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
              <Input
                placeholder={t("garage.engine")}
                value={form.engine}
                readOnly
                className="sm:col-span-2 bg-muted/40"
                title={t("garage.engineFromVariant")}
              />
            </div>
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
            <input
              ref={imageUpload.inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => handleImageUpload(e.target.files)}
              className="text-sm"
              disabled={imageUpload.uploading}
            />
            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {images.map((url, i) => (
                  <img key={i} src={mediaUrl(url)} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />
                ))}
              </div>
            )}
            <Button
              className="w-full"
              disabled={
                !form.make ||
                !form.model ||
                !form.variantId ||
                createVehicle.isPending ||
                imageUpload.uploading
              }
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
        <EmptyState
          icon={Car}
          title={t("garage.empty")}
          description={t("garage.emptyDesc")}
          action={<Button size="sm" onClick={() => setShowForm(true)}>{t("garage.add")}</Button>}
        />
      ) : (
        <div className="space-y-4">
          {primary && vehicles.length > 1 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-2">{t("garage.mainVehicle")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">{renderVehicleCard(primary, true)}</div>
            </div>
          )}
          {(others.length > 0 || (vehicles.length === 1 && primary)) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {vehicles.length === 1 && primary
                ? renderVehicleCard(primary)
                : others.map((v) => renderVehicleCard(v))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <VehicleDetailModal
          vehicle={selected}
          onClose={() => setSelected(null)}
          editable
          onCreatePost={handleCreatePost}
        />
      )}
      </div>
    </>
  );
}
