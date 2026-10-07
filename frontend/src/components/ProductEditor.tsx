import { ImagePlus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import FitImage from "@/components/FitImage";
import OwnerMediaThumb from "@/components/OwnerMediaThumb";
import { categoryFields, fieldLabel, PRODUCT_CATEGORIES, type ProductField } from "@/lib/productFields";
import PostImageAdjust from "@/components/PostImageAdjust";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, Product } from "@/lib/api";
import { MAX_IMAGE_BYTES, MediaUploadError } from "@/lib/mediaUpload";
import { decimalOnly, digitsOnly, YEAR_DIGITS } from "@/lib/numericInput";

const CATEGORIES = PRODUCT_CATEGORIES;
const MAX_IMAGES = 8;

interface ProductEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product?: Product | null;
}

function draftKey(userId: string) {
  return `motorclub_product_draft_v1:${userId}`;
}

export default function ProductEditor({ open, onClose, onSaved, product }: ProductEditorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const titleId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("spareParts");
  const [condition, setCondition] = useState("");
  const [fitMake, setFitMake] = useState("");
  const [fitModel, setFitModel] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [pickup, setPickup] = useState("");
  const [ships, setShips] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  // Cropping is part of uploading: photos added in this session keep their file here, keyed by reference.
  const [localFiles, setLocalFiles] = useState<Record<string, File>>({});
  // On-device previews of those photos, so the editor shows them before the processed copies exist.
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const [adjust, setAdjust] = useState<{ index: number; src: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");
  const [lowQuality, setLowQuality] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setDescription(product.description || "");
      setPrice(String(product.price));
      setCategory((CATEGORIES as readonly string[]).includes(product.category) ? product.category as typeof category : "other");
      setCondition(product.condition || "");
      setFitMake(product.fit_make || "");
      setFitModel(product.fit_model || "");
      setYearFrom(product.fit_year_from ? String(product.fit_year_from) : "");
      setYearTo(product.fit_year_to ? String(product.fit_year_to) : "");
      setBrand(product.brand || "");
      setSku(product.sku || "");
      setPickup(product.pickup_area || "");
      setShips(Boolean(product.ships));
      setImages(product.image_urls || []);
      return;
    }
    if (!user) return;
    try {
      const raw = localStorage.getItem(draftKey(user.id));
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      setName(String(draft.name || ""));
      setDescription(String(draft.description || ""));
      setPrice(String(draft.price || ""));
      setImages(Array.isArray(draft.images) ? draft.images.filter((item) => typeof item === "string") : []);
      if (typeof draft.category === "string" && (CATEGORIES as readonly string[]).includes(draft.category)) {
        setCategory(draft.category as typeof category);
      }
      setCondition(String(draft.condition || ""));
      setFitMake(String(draft.fitMake || ""));
      setFitModel(String(draft.fitModel || ""));
      setBrand(String(draft.brand || ""));
      setSku(String(draft.sku || ""));
      setPickup(String(draft.pickup || ""));
    } catch {
      // ignore broken drafts
    }
  }, [open, product, user]);

  // Fields that do not belong to the chosen category are saved empty, so nothing typed before switching stays behind.
  const fields = categoryFields(category);
  const has = (field: ProductField) => fields.fields.includes(field);
  const payload = {
    name: name.trim(),
    description: description.trim() || null,
    price: Number(price),
    category,
    image_urls: images,
    condition: condition && (fields.conditions as readonly string[]).includes(condition) ? condition : null,
    fit_make: has("fitMake") ? fitMake.trim() || null : null,
    fit_model: has("fitModel") ? fitModel.trim() || null : null,
    fit_year_from: has("yearFrom") && yearFrom ? Number(yearFrom) : null,
    fit_year_to: has("yearTo") && yearTo ? Number(yearTo) : null,
    brand: has("brand") ? brand.trim() || null : null,
    sku: has("sku") ? sku.trim() || null : null,
    pickup_area: pickup.trim() || null,
    ships: has("ships") ? ships : false,
  };

  const missing = [
    name.trim().length < 2 ? t("productEditor.needName") : "",
    !(Number(price) > 0) ? t("productEditor.needPrice") : "",
    images.length === 0 ? t("productEditor.needImage") : "",
  ].filter(Boolean);

  const saveDraft = () => {
    if (!user || product) return;
    localStorage.setItem(draftKey(user.id), JSON.stringify({
      name, description, price, category, condition, fitMake, fitModel, brand, sku, pickup, images,
    }));
    setSavedAt(new Date().toLocaleTimeString());
    toast.success(t("productEditor.draftSaved"));
  };

  const uploadFiles = async (list: FileList | null) => {
    if (!list) return;
    for (const file of Array.from(list)) {
      if (images.length >= MAX_IMAGES) {
        toast.error(t("productEditor.tooMany", { count: MAX_IMAGES }));
        break;
      }
      if (file.type === "image/gif") {
        toast.error(t("productEditor.noGif"));
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(t("composer.imageTooLarge", { mb: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)) }));
        continue;
      }
      try {
        const result = await api.uploadMedia(file, "product");
        setImages((prev) => [...prev, result.reference].slice(0, MAX_IMAGES));
        setLocalFiles((prev) => ({ ...prev, [result.reference]: file }));
        const preview = URL.createObjectURL(file);
        setLocalPreviews((prev) => ({ ...prev, [result.reference]: preview }));
        // Measured on the device; downloading the upload just to read its size would cost a transfer.
        const probe = new Image();
        probe.onload = () => {
          if (probe.naturalWidth < 600 || probe.naturalHeight < 600) setLowQuality(true);
        };
        probe.src = preview;
      } catch (err) {
        const message = err instanceof MediaUploadError ? err.message : t("composer.uploadFailed");
        toast.error(message);
      }
    }
  };

  const submit = async (publish: boolean) => {
    if (publish && missing.length) {
      setFieldError(missing.join(" · "));
      return;
    }
    setBusy(true);
    setFieldError("");
    try {
      const body = { ...payload, publish };
      const saved = product
        ? await api.updateProduct(product.id, body)
        : await api.createProduct(body);
      if (!product && user) localStorage.removeItem(draftKey(user.id));
      if (saved.listing_status === "published") toast.success(t("productEditor.published"));
      // The editor closes right away, so a held product gets a longer toast that says what happens next.
      else if (publish) {
        const action = { label: t("productEditor.held.action"), onClick: () => navigate("/marketplace?mine=1") };
        if (saved.moderation_status === "rejected") toast.error(t("productEditor.held.rejectedTitle"), { description: t("productEditor.held.rejectedBody"), duration: 12000, action });
        else toast.warning(t("productEditor.held.title"), { description: t(saved.moderation_status === "error" ? "productEditor.held.errorBody" : "productEditor.held.reviewBody"), duration: 12000, action });
      }
      else toast.success(t("productEditor.draftSaved"));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setBusy(false);
    }
  };

  const closeAdjust = () => {
    if (adjust) URL.revokeObjectURL(adjust.src);
    setAdjust(null);
  };

  if (!open) return null;
  const previewProduct: Product = {
    id: product?.id || "preview",
    business_id: user?.id || "",
    name: name || t("productEditor.previewName"),
    description,
    price: Number(price) || 0,
    category,
    image_urls: images,
    condition: condition || null,
    pickup_area: pickup || null,
    created_at: new Date().toISOString(),
    seller: user,
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center md:items-center md:p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label={t("composer.close")} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative flex h-[100dvh] w-full max-w-[1100px] flex-col bg-card md:h-[min(88vh,860px)] md:rounded-2xl md:border md:border-border">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-lg font-semibold">{product ? t("businessSettings.editProduct") : t("productEditor.create")}</h2>
          <button type="button" className="min-h-10 rounded-lg px-3 text-sm" onClick={onClose} aria-label={t("composer.close")}>{t("composer.close")}</button>
        </header>
        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-0 space-y-4 overflow-y-auto p-4">
            <div
              className="rounded-2xl border border-dashed border-border p-4"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void uploadFiles(event.dataTransfer.files);
              }}
            >
              <button type="button" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4 text-primary" aria-hidden />
                {t("productEditor.addPhotos")}
              </button>
              <p className="mt-1 text-xs text-muted-foreground">{t("productEditor.photoHint", { count: MAX_IMAGES, mb: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)) })}</p>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label={t("productEditor.addPhotos")} onChange={(event) => { void uploadFiles(event.target.files); event.target.value = ""; }} />
              {lowQuality && <p className="mt-2 text-xs text-amber-500">{t("productEditor.lowQuality")}</p>}
              <ul className="mt-3 space-y-2">
                {images.map((image, index) => (
                  <li key={`${image}-${index}`} className="flex items-center gap-2">
                    {localPreviews[image] ? (
                      <FitImage src={localPreviews[image]} alt="" className="h-14 w-14 rounded-lg bg-black" />
                    ) : (
                      <OwnerMediaThumb className="h-14 w-14 rounded-lg bg-black" storageKey={image} />
                    )}
                    <span className="text-xs">{index === 0 ? t("productEditor.primary") : index + 1}</span>
                    <button type="button" className="min-h-8 rounded-lg border px-2 text-xs" disabled={index === 0} onClick={() => setImages((prev) => { const next = prev.slice(); const [item] = next.splice(index, 1); next.unshift(item); return next; })}>{t("productEditor.makePrimary")}</button>
                    <button type="button" className="min-h-8 rounded-lg border px-2 text-xs" disabled={index === 0} onClick={() => setImages((prev) => { const next = prev.slice(); const [item] = next.splice(index, 1); next.splice(index - 1, 0, item); return next; })} aria-label={t("composer.moveEarlier")}>↑</button>
                    <button type="button" className="min-h-8 rounded-lg border px-2 text-xs" disabled={index === images.length - 1} onClick={() => setImages((prev) => { const next = prev.slice(); const [item] = next.splice(index, 1); next.splice(index + 1, 0, item); return next; })} aria-label={t("composer.moveLater")}>↓</button>
                    {localFiles[image] ? (
                      <button type="button" className="min-h-8 rounded-lg border px-2 text-xs" onClick={() => setAdjust({ index, src: URL.createObjectURL(localFiles[image]) })}>{t("composer.editCrop")}</button>
                    ) : null}
                    <button type="button" className="min-h-8 rounded-lg border px-2 text-xs text-destructive" onClick={() => setImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>{t("composer.remove")}</button>
                  </li>
                ))}
              </ul>
            </div>
            <label className="block text-sm" htmlFor="product-name">{t("businessSettings.productName")}</label>
            <Input id="product-name" value={name} onChange={(event) => setName(event.target.value)} />
            <label className="block text-sm" htmlFor="product-category">{t("businessSettings.productCategory")}</label>
            <select id="product-category" value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              {CATEGORIES.map((item) => <option key={item} value={item}>{t(`categories.${item}`)}</option>)}
            </select>
            <label className="block text-sm" htmlFor="product-condition">{t("productEditor.conditionLabel")}</label>
            <select id="product-condition" value={condition} onChange={(event) => setCondition(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <option value="">{t("productEditor.unspecified")}</option>
              {fields.conditions.map((item) => <option key={item} value={item}>{t(`productEditor.condition.${item}`)}</option>)}
            </select>
            <label className="block text-sm" htmlFor="product-price">{t("businessSettings.productPrice")}</label>
            <Input id="product-price" value={price} onChange={(event) => setPrice(decimalOnly(event.target.value))} inputMode="decimal" dir="ltr" />
            <label className="block text-sm" htmlFor="product-description">{t("businessSettings.productDescription")}</label>
            <textarea id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid gap-2 sm:grid-cols-2">
              {has("fitMake") && <Input value={fitMake} onChange={(event) => setFitMake(event.target.value)} placeholder={t(fieldLabel(category, "fitMake"))} aria-label={t(fieldLabel(category, "fitMake"))} />}
              {has("fitModel") && <Input value={fitModel} onChange={(event) => setFitModel(event.target.value)} placeholder={t(fieldLabel(category, "fitModel"))} aria-label={t(fieldLabel(category, "fitModel"))} />}
              {has("yearFrom") && <Input value={yearFrom} onChange={(event) => setYearFrom(digitsOnly(event.target.value, YEAR_DIGITS))} placeholder={t(fieldLabel(category, "yearFrom"))} aria-label={t(fieldLabel(category, "yearFrom"))} inputMode="numeric" />}
              {has("yearTo") && <Input value={yearTo} onChange={(event) => setYearTo(digitsOnly(event.target.value, YEAR_DIGITS))} placeholder={t(fieldLabel(category, "yearTo"))} aria-label={t(fieldLabel(category, "yearTo"))} inputMode="numeric" />}
              {has("brand") && <Input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder={t(fieldLabel(category, "brand"))} aria-label={t(fieldLabel(category, "brand"))} />}
              {has("sku") && <Input value={sku} onChange={(event) => setSku(event.target.value)} placeholder={t(fieldLabel(category, "sku"))} aria-label={t(fieldLabel(category, "sku"))} />}
              <Input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder={t("productEditor.pickup")} aria-label={t("productEditor.pickup")} />
            </div>
            {has("ships") && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ships} onChange={(event) => setShips(event.target.checked)} />
                {t("productEditor.ships")}
              </label>
            )}
            {fieldError && <p className="text-sm text-destructive" role="alert">{fieldError}</p>}
            {savedAt && <p className="text-xs text-muted-foreground">{t("productEditor.savedAt", { time: savedAt })}</p>}
          </div>
          <aside className="hidden border-s border-border bg-muted/20 p-4 md:block">
            <ProductCard product={previewProduct} imageSrc={images[0] ? localPreviews[images[0]] : undefined} />
          </aside>
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!product && <Button type="button" variant="outline" disabled={busy} onClick={saveDraft}>{t("productEditor.saveDraft")}</Button>}
          <Button type="button" className="!shadow-none" disabled={busy} onClick={() => void submit(true)}>
            {busy ? t("productEditor.saving") : product ? t("productEditor.saveChanges") : t("productEditor.publish")}
          </Button>
          {missing.length > 0 && <p className="text-xs text-muted-foreground">{missing.join(" · ")}</p>}
        </footer>
        {adjust && images[adjust.index] && (
          <PostImageAdjust
            src={adjust.src}
            fileName="product.jpg"
            initialAspect={1}
            canReset={false}
            onCancel={() => closeAdjust()}
            onReset={() => closeAdjust()}
            onSourceError={() => {
              toast.error(t("composer.cropNeedsFile"));
              closeAdjust();
            }}
            onApply={async (file) => {
              const { index } = adjust;
              const previous = images[index];
              try {
                const result = await api.uploadMedia(file, "product");
                setImages((prev) => prev.map((item, itemIndex) => itemIndex === index ? result.reference : item));
                // A second crop starts again from the photo as it was uploaded.
                setLocalFiles((prev) => ({ ...prev, [result.reference]: prev[previous] ?? file }));
                setLocalPreviews((prev) => ({ ...prev, [result.reference]: URL.createObjectURL(file) }));
              } catch (err) {
                toast.error(err instanceof MediaUploadError ? err.message : t("composer.uploadFailed"));
              }
              closeAdjust();
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
