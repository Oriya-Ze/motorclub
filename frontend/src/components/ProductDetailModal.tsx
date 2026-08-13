import { useMutation } from "@tanstack/react-query";
import { Mail, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import { Button } from "@/components/ui/Button";
import { api, Product } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { formatHandle } from "@/lib/utils";

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
}

export default function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const contactSeller = useMutation({
    mutationFn: () => api.startConversation(product.business_id),
    onSuccess: (conv) => {
      onClose();
      navigate(`/messages/${conv.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
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
          {product.image_urls?.[0] ? (
            <img src={mediaUrl(product.image_urls[0])} alt={product.name} className="w-full h-56 object-cover rounded-xl" />
          ) : (
            <VehiclePlaceholder className="h-56 rounded-xl" />
          )}

          <p className="text-3xl font-display tracking-wide text-primary">₪{product.price.toLocaleString()}</p>

          {product.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
          )}

          {product.seller && (
            <Link
              to={`/profile/${product.seller.id}`}
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

          <Button
            className="w-full gap-2"
            onClick={() => contactSeller.mutate()}
            disabled={contactSeller.isPending}
          >
            <Mail className="w-4 h-4" />
            {t("contactSeller")}
          </Button>
        </div>
      </div>
    </div>
  );
}
