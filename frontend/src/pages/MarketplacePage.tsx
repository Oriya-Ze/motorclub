import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const CATEGORIES = ["vehicles", "spareParts", "accessories", "services", "other"] as const;

export default function MarketplacePage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", category],
    queryFn: () => api.getProducts(category || undefined),
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">...</div>;

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
        <p className="text-muted-foreground text-center py-12">{t("noProducts")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id}>
              {product.image_urls?.[0] && (
                <img src={mediaUrl(product.image_urls[0])} alt={product.name} className="w-full h-40 object-cover rounded-t-2xl" />
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
          ))}
        </div>
      )}
    </div>
  );
}
