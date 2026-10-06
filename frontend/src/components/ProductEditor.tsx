import { ImagePlus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import OwnerMediaThumb from "@/components/OwnerMediaThumb";
import PostImageAdjust from "@/components/PostImageAdjust";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, Product } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { MAX_IMAGE_BYTES, MediaUploadError } from "@/lib/mediaUpload";

const CATEGORIES = ["vehicles", "spareParts", "accessories", "other"] as const;
const CONDITIONS = ["new", "used", "refurbished"] as const;
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
  const [adjustIndex, setAdjustIndex] = useState<number | null>(null);
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

  const payload = {
    name: name.trim(),
    description: description.trim() || null,
    price: Number(price),
    category,
    image_urls: images,
    condition: condition || null,
    fit_make: fitMake.trim() || null,
    fit_model: fitModel.trim() || null,
    fit_year_from: yearFrom ? Number(yearFrom) : null,
    fit_year_to: yearTo ? Number(yearTo) : null,
    brand: brand.trim() || null,
    sku: sku.trim() || null,
    pickup_area: pickup.trim() || null,
    ships,
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
        const probe = new Image();
        probe.onload = () => {
          if (probe.naturalWidth < 600 || probe.naturalHeight < 600) setLowQuality(true);
        };
        probe.src = mediaUrl(result.reference);
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
                    <OwnerMediaThumb className="h-14 w-14 rounded-lg object-contain" storageKey={image} />
                    <span className="text-xs">{index === 0 ? t("productEditor.primary") : index + 1}</span>
                    <button type="button" className="min-h-8 rounded-lg border px-2 text-xs" disabled={index === 0} onClick={() => setImages((prev) => { const next = prev.slice(); const [item] = next.splice(index, 1); next.unshift(item); return next; })}>{t("productEditor.makePrimary")}</button>
                    <button type="button" className="min-h-8 rounded-lg border px-2 text-xs" disabled={index === 0} onClick={() => setImages((prev) => { const next = prev.slice(); const [item] = next.splice(index, 1); next.splice(index - 1, 0, item); return next; })} aria-label={t("composer.moveEarlier")}>↑</button>
                    <button type="button" className="min-h-8 rounded-lg border px-2 text-xs" disabled={index === images.length - 1} onClick={() => setImages((prev) => { const next = prev.slice(); const [item] = next.splice(index, 1); next.splice(index + 1, 0, item); return next; })} aria-label={t("composer.moveLater")}>↓</button>
                    <button type="button" className="min-h-8 rounded-lg border px-2 text-xs" onClick={() => setAdjustIndex(index)}>{t("composer.editCrop")}</button>
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
              {CONDITIONS.map((item) => <option key={item} value={item}>{t(`productEditor.condition.${item}`)}</option>)}
            </select>
            <label className="block text-sm" htmlFor="product-price">{t("businessSettings.productPrice")}</label>
            <Input id="product-price" value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" dir="ltr" />
            <label className="block text-sm" htmlFor="product-description">{t("businessSettings.productDescription")}</label>
            <textarea id="product-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={fitMake} onChange={(event) => setFitMake(event.target.value)} placeholder={t("productEditor.fitMake")} aria-label={t("productEditor.fitMake")} />
              <Input value={fitModel} onChange={(event) => setFitModel(event.target.value)} placeholder={t("productEditor.fitModel")} aria-label={t("productEditor.fitModel")} />
              <Input value={yearFrom} onChange={(event) => setYearFrom(event.target.value)} placeholder={t("productEditor.yearFrom")} aria-label={t("productEditor.yearFrom")} />
              <Input value={yearTo} onChange={(event) => setYearTo(event.target.value)} placeholder={t("productEditor.yearTo")} aria-label={t("productEditor.yearTo")} />
              <Input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder={t("productEditor.brand")} aria-label={t("productEditor.brand")} />
              <Input value={sku} onChange={(event) => setSku(event.target.value)} placeholder={t("productEditor.sku")} aria-label={t("productEditor.sku")} />
              <Input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder={t("productEditor.pickup")} aria-label={t("productEditor.pickup")} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ships} onChange={(event) => setShips(event.target.checked)} />
              {t("productEditor.ships")}
            </label>
            {fieldError && <p className="text-sm text-destructive" role="alert">{fieldError}</p>}
            {savedAt && <p className="text-xs text-muted-foreground">{t("productEditor.savedAt", { time: savedAt })}</p>}
          </div>
          <aside className="hidden border-s border-border bg-muted/20 p-4 md:block">
            <ProductCard product={previewProduct} preferOriginal />
          </aside>
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {!product && <Button type="button" variant="outline" disabled={busy} onClick={saveDraft}>{t("productEditor.saveDraft")}</Button>}
          <Button type="button" className="!shadow-none" disabled={busy} onClick={() => void submit(true)}>
            {busy ? t("productEditor.saving") : product ? t("productEditor.saveChanges") : t("productEditor.publish")}
          </Button>
          {missing.length > 0 && <p className="text-xs text-muted-foreground">{missing.join(" · ")}</p>}
        </footer>
        {adjustIndex != null && images[adjustIndex] && (
          <PostImageAdjust
            src={mediaUrl(images[adjustIndex])}
            fileName="product.jpg"
            canReset={false}
            onCancel={() => setAdjustIndex(null)}
            onReset={() => setAdjustIndex(null)}
            onSourceError={() => toast.error(t("composer.cropNeedsFile"))}
            onApply={async (file) => {
              const result = await api.uploadMedia(file, "product");
              setImages((prev) => prev.map((item, index) => index === adjustIndex ? result.reference : item));
              setAdjustIndex(null);
            }}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
