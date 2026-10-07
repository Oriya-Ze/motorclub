import { useMutation } from "@tanstack/react-query";
import { Mail, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import ReportDialog from "@/components/ReportDialog";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useMessagesPanelOptional } from "@/components/MessagesPanel";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import BusinessListingBadge from "@/components/BusinessListingBadge";
import EditProductModal from "@/components/EditProductModal";
import MediaLightbox from "@/components/MediaLightbox";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { api, Product } from "@/lib/api";
import { getUserProfilePath } from "@/lib/businessProfile";
import { withReturnTo } from "@/lib/returnTo";
import StoredImage from "@/components/StoredImage";
import { mediaUrl } from "@/lib/media";
import { pickStoredImageUrl } from "@/lib/postMedia";
import { formatHandle } from "@/lib/utils";
import { categoryFields } from "@/lib/productFields";
import type { TFunction } from "i18next";

/** Labelled details for the product page, using the same per-category fields as the editor. */
function productDetails(product: Product, t: TFunction): [string, string][] {
  const fields = categoryFields(product.category).fields;
  const rows: [string, string][] = [];
  if (product.condition) rows.push([t("productEditor.conditionLabel"), t(`productEditor.condition.${product.condition}`)]);
  if (product.category === "vehicles") {
    if (product.fit_make) rows.push([t("productEditor.vehicleMake"), product.fit_make]);
    if (product.fit_model) rows.push([t("productEditor.vehicleModel"), product.fit_model]);
    if (product.fit_year_from) rows.push([t("productEditor.vehicleYear"), String(product.fit_year_from)]);
  } else {
    const from = fields.includes("yearFrom") ? product.fit_year_from : null;
    const to = fields.includes("yearTo") ? product.fit_year_to : null;
    const years = from && to ? t("productEditor.detail.yearsRange", { from, to }) : from ? t("productEditor.detail.yearsFrom", { from }) : to ? t("productEditor.detail.yearsTo", { to }) : "";
    const fits = [fields.includes("fitMake") && product.fit_make, fields.includes("fitModel") && product.fit_model, years].filter(Boolean).join(" ");
    if (fits) rows.push([t("productEditor.detail.fits"), fits]);
    if (fields.includes("brand") && product.brand) rows.push([t("productEditor.detail.brand"), product.brand]);
    if (fields.includes("sku") && product.sku) rows.push([t("productEditor.detail.sku"), product.sku]);
  }
  if (product.pickup_area) rows.push([t("productEditor.pickup"), product.pickup_area]);
  if (fields.includes("ships") && product.ships) rows.push([t("productEditor.detail.shipping"), t("productEditor.detail.shipsYes")]);
  return rows;
}

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onChanged?: () => void;
}

export default function ProductDetailModal({ product, onClose, onChanged }: ProductDetailModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const messagesPanel = useMessagesPanelOptional();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const details = productDetails(product, t);
  const [reporting, setReporting] = useState(false);
  const photos = product.image_urls ?? [];
  const isOwner = user?.id === product.business_id;

  const contactSeller = useMutation({
    mutationFn: () => api.startConversation(product.business_id),
    onSuccess: (conv) => {
      onClose();
      messagesPanel?.openMessages(conv.id);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProduct = useMutation({
    mutationFn: () => api.deleteProduct(product.id),
    onSuccess: () => {
      toast.success(t("businessSettings.productDeleted"));
      onChanged?.();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-t-3xl sm:rounded-2xl shadow-glow">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/50 bg-card/95 backdrop-blur">
          <h2 className="text-lg font-bold truncate pe-4">{product.name}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={t("close")}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {photos[0] ? (
            <button type="button" className="relative block w-full" onClick={() => { setPhotoIdx(0); setPhotoOpen(true); }} aria-label={t("viewFullMedia")}>
              <StoredImage sourceKey={photos[0]} preferredKey={pickStoredImageUrl(photos[0], null, "detail")} alt={product.name} className="w-full h-56 rounded-xl bg-black object-contain" />
              {product.seller?.account_type === "business" && (
                <BusinessListingBadge className="absolute top-2 start-2" />
              )}
            </button>
          ) : (
            <div className="relative">
              <VehiclePlaceholder className="h-56 rounded-xl" />
              {product.seller?.account_type === "business" && (
                <BusinessListingBadge className="absolute top-2 start-2" />
              )}
            </div>
          )}

          <p className="text-3xl font-display tracking-wide text-primary">₪{product.price.toLocaleString()}</p>

          {details.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/30 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-medium"><bdi>{value}</bdi></dd>
                </div>
              ))}
            </dl>
          )}
          {product.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
          )}

          {product.seller && (
            <Link
              to={withReturnTo(getUserProfilePath(product.seller), `/marketplace?product=${product.id}`)}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              onClick={onClose}
            >
              <Avatar user={product.seller} size="md" />
              <div>
                <p className="font-medium text-sm">{product.seller.full_name}</p>
                <p className="text-xs text-muted-foreground">{formatHandle(product.seller)}</p>
              </div>
            </Link>
          )}

          {/* The main action stays on screen while the details scroll, so it is never below the fold on a phone. */}
          <div className="sticky bottom-0 -mx-4 -mb-4 space-y-2 border-t border-border/50 bg-card/95 p-4 backdrop-blur">
          {isOwner ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4" />
                {t("businessSettings.editProduct")}
              </Button>
              <Button
                variant="destructive"
                className="gap-2"
                disabled={deleteProduct.isPending}
                onClick={() => {
                  if (window.confirm(t("businessSettings.confirmDelete"))) deleteProduct.mutate();
                }}
              >
                <Trash2 className="w-4 h-4" />
                {t("marketplaceDelete")}
              </Button>
            </div>
          ) : (
            <>
            <Button
              className="w-full gap-2"
              onClick={() => contactSeller.mutate()}
              disabled={contactSeller.isPending}
            >
              <Mail className="w-4 h-4" />
              {t("contactSeller")}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setReporting(true)}>{t("reports.title")}</Button>
            </>
          )}
          </div>
      {reporting && <ReportDialog targetType="product" targetId={product.id} onClose={() => setReporting(false)} />}
        </div>
      </div>
    </div>
    {editing && (
      <EditProductModal
        product={product}
        open
        onClose={() => setEditing(false)}
        onUpdated={() => {
          setEditing(false);
          onChanged?.();
          onClose();
        }}
      />
    )}
    <MediaLightbox
      open={photoOpen}
      items={photos.map((url) => ({ kind: "image" as const, src: mediaUrl(pickStoredImageUrl(url, null, "detail")), alt: product.name }))}
      index={photoIdx}
      onClose={() => setPhotoOpen(false)}
      onIndexChange={setPhotoIdx}
    />
    </>
  );
}
