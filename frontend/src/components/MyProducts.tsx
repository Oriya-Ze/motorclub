import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, EyeOff, FileText, Package, Pencil, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import EditProductModal from "@/components/EditProductModal";
import OwnerMediaThumb from "@/components/OwnerMediaThumb";
import { Button } from "@/components/ui/Button";
import { api, Product } from "@/lib/api";
import { cn } from "@/lib/utils";

type ProductState = "published" | "review" | "rejected" | "hidden" | "draft";

const STATE_STYLE: Record<ProductState, { icon: typeof Clock; className: string }> = {
  published: { icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  review: { icon: Clock, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  rejected: { icon: XCircle, className: "bg-destructive/15 text-destructive" },
  hidden: { icon: EyeOff, className: "bg-muted text-muted-foreground" },
  draft: { icon: FileText, className: "bg-muted text-muted-foreground" },
};

/** Where a product stands, and which explanation the seller should see. */
function productState(product: Product): { state: ProductState; help?: string } {
  if (product.listing_status === "published") return { state: "published" };
  if (product.listing_status === "hidden") return { state: "hidden", help: "hidden" };
  if (product.listing_status === "draft") return { state: "draft", help: "draft" };
  if (product.moderation_status === "rejected") return { state: "rejected", help: "rejected" };
  if (product.moderation_status === "error") return { state: "review", help: "error" };
  return { state: "review", help: "review" };
}

/** The viewer's own products with their review status, for every member and business. */
export default function MyProducts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["my-products"],
    queryFn: () => api.getMyProducts(),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-products"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["product-page"] });
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      toast.success(t("productEditor.deleted"));
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground" role="status">{t("loading")}</p>;
  if (products.length === 0) {
    return <p className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground">{t("productEditor.mineEmpty")}</p>;
  }

  return (
    <>
      <ul className="space-y-2">
        {products.map((product) => {
          const { state, help } = productState(product);
          const { icon: Icon, className } = STATE_STYLE[state];
          return (
            <li key={product.id} className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/50 p-3">
              {product.image_urls?.[0] ? (
                <OwnerMediaThumb storageKey={product.image_urls[0]} className="h-16 w-16 shrink-0 rounded-xl bg-black" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{product.name}</p>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", className)}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {t(`productEditor.status.${state}`)}
                  </span>
                </div>
                <p className="text-sm text-primary">₪{product.price.toLocaleString()}</p>
                {help ? <p className="text-xs leading-relaxed text-muted-foreground">{t(`productEditor.statusHelp.${help}`)}</p> : null}
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                <Button variant="ghost" size="sm" onClick={() => setEditing(product)} aria-label={t("productEditor.edit", { name: product.name })}>
                  <Pencil className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={remove.isPending}
                  aria-label={t("productEditor.remove", { name: product.name })}
                  onClick={() => {
                    if (window.confirm(t("productEditor.confirmDelete"))) remove.mutate(product.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && (
        <EditProductModal product={editing} open onClose={() => setEditing(null)} onUpdated={refresh} />
      )}
    </>
  );
}
