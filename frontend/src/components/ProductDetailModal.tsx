import { useMutation } from "@tanstack/react-query";
import { Mail, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
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
import { mediaUrl } from "@/lib/media";
import { formatHandle } from "@/lib/utils";

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
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {photos[0] ? (
            <button type="button" className="relative block w-full" onClick={() => { setPhotoIdx(0); setPhotoOpen(true); }} aria-label={t("viewFullMedia")}>
              <img src={mediaUrl(photos[0])} alt={product.name} className="w-full h-56 object-cover rounded-xl" />
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

          {product.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
          )}

          {product.seller && (
            <Link
              to={getUserProfilePath(product.seller)}
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
            <Button
              className="w-full gap-2"
              onClick={() => contactSeller.mutate()}
              disabled={contactSeller.isPending}
            >
              <Mail className="w-4 h-4" />
              {t("contactSeller")}
            </Button>
          )}
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
      items={photos.map((url) => ({ kind: "image" as const, src: mediaUrl(url), alt: product.name }))}
      index={photoIdx}
      onClose={() => setPhotoOpen(false)}
      onIndexChange={setPhotoIdx}
    />
    </>
  );
}
