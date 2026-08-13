import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import ProductDetailModal from "@/components/ProductDetailModal";
import { Card, CardContent } from "@/components/ui/Card";
import { CardGridSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { api, Product } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const CATEGORIES = ["vehicles", "spareParts", "accessories", "services", "other"] as const;

export default function MarketplacePage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>("");
  const [selected, setSelected] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", category],
    queryFn: () => api.getProducts(category || undefined),
  });

  if (isLoading) return <CardGridSkeleton count={4} />;

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <h1 className="text-2xl font-bold">{t("marketplace")}</h1>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setCategory("")}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors",
            !category ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          {t("allCategories")}
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors",
              category === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/50"
            )}
          >
            {t(`categories.${cat}`)}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">{t("noProducts")}</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("marketplaceEmptyCta")}</p>
          <Link to="/explore"><Button variant="outline" size="sm">{t("explore")}</Button></Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelected(product)}
              className="text-start rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Card className="overflow-hidden hover:shadow-glow transition-shadow h-full cursor-pointer">
                {product.image_urls?.[0] && (
                  <img src={mediaUrl(product.image_urls[0])} alt={product.name} className="w-full h-40 object-cover" />
                )}
                <CardContent className="pt-6">
                  <span className="text-xs px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                    {t(`categories.${product.category as typeof CATEGORIES[number]}`)}
                  </span>
                  <h3 className="font-semibold mt-3">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                  )}
                  <p className="text-primary font-bold text-lg mt-3">₪{product.price.toLocaleString()}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selected && <ProductDetailModal product={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
