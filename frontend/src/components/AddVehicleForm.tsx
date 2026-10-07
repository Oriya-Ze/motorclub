import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Car, PenLine, Wrench, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import VehicleModEditor from "@/components/VehicleModEditor";
import VehiclePhotosField, { MAX_VEHICLE_PHOTOS } from "@/components/VehiclePhotosField";
import FitImage from "@/components/FitImage";
import StoredImage from "@/components/StoredImage";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useAuth } from "@/contexts/AuthContext";
import { api, Vehicle, VehicleCatalogVariant, VehicleModItem } from "@/lib/api";
import { formatEngineLabel } from "@/lib/formatLabels";
import { digitsOnly, YEAR_DIGITS } from "@/lib/numericInput";

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

type VehicleForm = typeof emptyForm;

type Props = {
  existingCount: number;
  onCreated?: (vehicle: Vehicle) => void;
  onClose?: () => void;
};

function draftKey(userId: string) {
  return `motorclub_vehicle_draft_v1:${userId}`;
}

function readDraft(userId: string | undefined): { form: VehicleForm; images: string[] } | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as { form?: Partial<VehicleForm>; images?: unknown };
    const images = Array.isArray(draft.images) ? draft.images.filter((item): item is string => typeof item === "string") : [];
    return { form: { ...emptyForm, ...draft.form, mods: Array.isArray(draft.form?.mods) ? draft.form.mods : [] }, images };
  } catch {
    return null;
  }
}

function Section({ icon: Icon, title, hint, children }: { icon: typeof Car; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, children, className }: { id: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/** Adds a vehicle to the garage: a full-screen editor with photos, details, story and mods, and a live preview. */
export default function AddVehicleForm({ existingCount, onCreated, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const id = useId();
  const [restored] = useState(() => readDraft(user?.id));
  const [form, setForm] = useState<VehicleForm>(restored?.form ?? emptyForm);
  const [images, setImages] = useState<string[]>(restored?.images ?? []);
  const [photosKey, setPhotosKey] = useState(0);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [showRestored, setShowRestored] = useState(Boolean(restored && (restored.form.make || restored.images.length)));
  const [tried, setTried] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, []);

  // Keep a draft as the member types, so closing the editor never loses the work.
  useEffect(() => {
    if (!user) return;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey(user.id), JSON.stringify({ form, images }));
      } catch {
        // storage full or blocked: the editor still works without a draft
      }
    }, 400);
    return () => window.clearTimeout(handle);
  }, [form, images, user]);

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
    const year = variant.year_to ? String(variant.year_to) : variant.year_from ? String(variant.year_from) : "";
    const extras = [variant.horsepower ? `${variant.horsepower} כ״ס` : null, variant.fuel].filter(Boolean);
    const engine = formatEngineLabel(variant.engine || extras.join(" · "));
    setForm((prev) => ({ ...prev, variantId: variant.id, trim: variant.trim, engine, year: year || prev.year }));
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

  const missing = [!form.make.trim() && t("garage.editor.needMake"), !form.model.trim() && t("garage.editor.needModel")].filter(Boolean) as string[];

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
      if (user) localStorage.removeItem(draftKey(user.id));
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      toast.success(t("garage.added"));
      onCreated?.(vehicle);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const save = () => {
    setTried(true);
    if (missing.length || photosBusy) return;
    createVehicle.mutate();
  };

  const startOver = () => {
    if (user) localStorage.removeItem(draftKey(user.id));
    setForm(emptyForm);
    setImages([]);
    setPhotosKey((key) => key + 1);
    setShowRestored(false);
    setTried(false);
  };

  const title = [form.year, form.make, form.model].filter(Boolean).join(" ");
  const chips = [form.trim, formatEngineLabel(form.engine), form.color].filter(Boolean);
  const mods = form.mods.filter((item) => item.name.trim()).length;
  const busy = createVehicle.isPending;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center md:items-center md:p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label={t("composer.close")} tabIndex={-1} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="relative flex h-[100dvh] w-full max-w-[1100px] flex-col bg-card md:h-[min(90vh,900px)] md:rounded-2xl md:border md:border-border"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
              <Car className="h-4 w-4" aria-hidden />
            </span>
            <h2 id={`${id}-title`} className="text-lg font-semibold">{t("garage.editor.title")}</h2>
          </div>
          <button ref={closeRef} type="button" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-muted" onClick={onClose} aria-label={t("composer.close")}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 space-y-7 overflow-y-auto p-4 sm:p-5">
            {showRestored ? (
              <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
                {t("garage.editor.draftRestored")}
                <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={startOver}>
                  {t("garage.editor.startOver")}
                </button>
              </p>
            ) : null}

            <Section icon={Camera} title={t("garage.editor.sectionPhotos")} hint={t("garage.editor.sectionPhotosHint", { count: MAX_VEHICLE_PHOTOS })}>
              <VehiclePhotosField key={photosKey} initialUrls={images} onChange={setImages} onBusyChange={setPhotosBusy} onCoverPreview={setCoverPreview} disabled={busy} />
            </Section>

            <Section icon={Car} title={t("garage.editor.sectionDetails")}>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={form.manual}
                  onChange={(e) =>
                    setForm({ ...emptyForm, manual: e.target.checked, color: form.color, description: form.description, nickname: form.nickname, mods: form.mods })
                  }
                />
                {t("garage.notInCatalog")}
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {form.manual ? (
                  <>
                    <Field id={`${id}-make`} label={t("garage.make")}>
                      <Input id={`${id}-make`} value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} aria-invalid={tried && !form.make.trim()} />
                    </Field>
                    <Field id={`${id}-model`} label={t("garage.model")}>
                      <Input id={`${id}-model`} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} aria-invalid={tried && !form.model.trim()} />
                    </Field>
                    <Field id={`${id}-trim`} label={t("garage.trim")}>
                      <Input id={`${id}-trim`} value={form.trim} onChange={(e) => setForm({ ...form, trim: e.target.value })} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field id={`${id}-make`} label={t("garage.make")}>
                      <Select
                        id={`${id}-make`}
                        value={form.makeId}
                        disabled={makesLoading}
                        aria-invalid={tried && !form.make.trim()}
                        onChange={(e) => {
                          const nextMakeId = e.target.value;
                          const make = catalogMakes.find((m) => m.id === nextMakeId)?.name ?? "";
                          setForm({ ...form, makeId: nextMakeId, make, modelId: "", variantId: "", model: "", trim: "", engine: "", year: "" });
                        }}
                      >
                        <option value="">{makesLoading ? t("garage.loadingCatalog") : t("garage.selectMake")}</option>
                        {catalogMakes.map((make) => (
                          <option key={make.id} value={make.id}>{make.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`${id}-model`} label={t("garage.model")}>
                      <Select
                        id={`${id}-model`}
                        value={form.modelId}
                        disabled={!form.makeId || modelsLoading}
                        aria-invalid={tried && !form.model.trim()}
                        onChange={(e) => {
                          const nextModelId = e.target.value;
                          const model = catalogModels.find((m) => m.id === nextModelId)?.name ?? "";
                          setForm({ ...form, modelId: nextModelId, model, variantId: "", trim: "", engine: "", year: "" });
                        }}
                      >
                        <option value="">
                          {!form.makeId ? t("garage.selectMakeFirst") : modelsLoading ? t("garage.loadingCatalog") : t("garage.selectModel")}
                        </option>
                        {catalogModels.map((model) => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field id={`${id}-variant`} label={t("garage.editor.variant")} className="sm:col-span-2">
                      <Select
                        id={`${id}-variant`}
                        value={form.variantId}
                        disabled={!form.modelId || variantsLoading}
                        onChange={(e) => {
                          const variant = catalogVariants.find((v) => v.id === e.target.value);
                          if (variant) applyVariant(variant);
                          else setForm({ ...form, variantId: "", trim: "", engine: "" });
                        }}
                      >
                        <option value="">
                          {!form.modelId ? t("garage.selectModelFirst") : variantsLoading ? t("garage.loadingCatalog") : t("garage.selectVariantOptional")}
                        </option>
                        {catalogVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variantLabel(variant)}
                            {variant.engine ? ` — ${variant.engine}` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </>
                )}
                <Field id={`${id}-year`} label={t("garage.year")}>
                  <Input id={`${id}-year`} value={form.year} onChange={(e) => setForm({ ...form, year: digitsOnly(e.target.value, YEAR_DIGITS) })} dir="ltr" inputMode="numeric" />
                </Field>
                <Field id={`${id}-color`} label={t("garage.color")}>
                  <Input id={`${id}-color`} value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </Field>
                <Field id={`${id}-engine`} label={t("garage.engine")} className={form.manual ? undefined : "sm:col-span-2"}>
                  <Input id={`${id}-engine`} value={form.engine} onChange={(e) => setForm({ ...form, engine: e.target.value })} />
                </Field>
              </div>
            </Section>

            <Section icon={PenLine} title={t("garage.editor.sectionStory")}>
              <Field id={`${id}-nickname`} label={t("garage.editor.nickname")}>
                <Input id={`${id}-nickname`} value={form.nickname} maxLength={40} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder={t("garage.nicknameOptional")} />
              </Field>
              <Field id={`${id}-story`} label={t("garage.story")}>
                <textarea
                  id={`${id}-story`}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={t("garage.storyPlaceholder")}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </Field>
            </Section>

            <Section icon={Wrench} title={t("garage.editor.sectionMods")}>
              <VehicleModEditor items={form.mods} onChange={(next) => setForm((prev) => ({ ...prev, mods: next }))} disabled={busy} />
            </Section>
          </div>

          <aside className="hidden min-h-0 overflow-y-auto border-s border-border bg-muted/20 p-4 md:block" aria-label={t("garage.editor.preview")}>
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t("garage.editor.preview")}</p>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {coverPreview ? (
                <FitImage src={coverPreview} alt="" className="aspect-video w-full bg-black" />
              ) : images[0] ? (
                <StoredImage sourceKey={images[0]} className="aspect-video w-full bg-black" />
              ) : (
                <VehiclePlaceholder className="aspect-video w-full rounded-none" iconClassName="h-10 w-10" />
              )}
              <div className="space-y-2 p-3">
                <p className="text-lg font-bold leading-tight">{form.nickname.trim() || title || t("garage.editor.previewName")}</p>
                {form.nickname.trim() && title ? <p className="text-sm text-muted-foreground">{title}</p> : null}
                {chips.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <span key={chip} className="rounded-full bg-muted px-2 py-0.5 text-xs">{chip}</span>
                    ))}
                  </div>
                ) : null}
                {mods ? <p className="text-xs font-medium text-primary">{t("garage.editor.modsCount", { count: mods })}</p> : null}
                {form.description.trim() ? <p className="line-clamp-4 text-sm text-foreground/80">{form.description}</p> : null}
                {images.length > 1 ? <p className="text-xs text-muted-foreground">{t("garage.photoCount", { count: images.length })}</p> : null}
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button type="button" className="!shadow-none" disabled={busy || photosBusy} onClick={save}>
            {busy ? t("garage.editor.saving") : t("garage.save")}
          </Button>
          {photosBusy ? (
            <p className="text-xs text-muted-foreground" role="status">{t("garage.editor.waitingUploads")}</p>
          ) : missing.length ? (
            <p className={tried ? "text-xs text-destructive" : "text-xs text-muted-foreground"} role={tried ? "alert" : undefined}>
              {missing.join(" · ")}
            </p>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
