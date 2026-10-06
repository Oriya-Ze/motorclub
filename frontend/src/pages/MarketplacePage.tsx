import { ShoppingBag } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import ProductCard from "@/components/ProductCard";
import CreateProductModal from "@/components/CreateProductModal";
import MyProducts from "@/components/MyProducts";
import EmptyState from "@/components/EmptyState";
import PageHeading from "@/components/PageHeading";
import ProductDetailModal from "@/components/ProductDetailModal";
import { CardGridSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { api, Product } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORIES = ["vehicles", "spareParts", "accessories", "other"] as const;

export default function MarketplacePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<string>("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const [queryText, setQueryText] = useState("");
  const [sort, setSort] = useState("newest");
  const [condition, setCondition] = useState("");
  const [seller, setSeller] = useState("");
  const page = useQuery({
    queryKey: ["product-page", category, queryText, sort, condition, seller],
    queryFn: () => api.getProducts({
      category: category || undefined,
      q: queryText || undefined,
      sort,
      condition: condition || undefined,
      seller: seller || undefined,
      limit: 24,
    }),
  });
  const products = page.data?.items ?? [];
  const isLoading = page.isLoading;
  const mine = searchParams.get("mine") === "1";
  const productParam = searchParams.get("product");

  const setMine = (value: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("mine", "1");
    else next.delete("mine");
    setSearchParams(next, { replace: true });
  };

  // Links from notifications and the admin console open one product: /marketplace?product=<id>.
  // Clearing the parameter re-runs this effect, so the request must not be cancelled by its cleanup.
  useEffect(() => {
    if (!productParam) return;
    api.getProduct(productParam)
      .then(setSelected)
      .catch(() => toast.error(t("productEditor.unavailable")));
    const next = new URLSearchParams(searchParams);
    next.delete("product");
    setSearchParams(next, { replace: true });
  }, [productParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setShowCreate(true);
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (isLoading && !mine) {
    return <CardGridSkeleton count={8} className="grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" />;
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <PageHeading>{t("productEditor.shopTitle")}</PageHeading>
          <p className="text-sm text-muted-foreground">{t("productEditor.shopBody")}</p>
        </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            {t("productEditor.publish")}
          </Button>
      </div>

      <div role="tablist" aria-label={t("productEditor.shopTitle")} className="inline-flex rounded-xl border border-border bg-card/50 p-1">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="tab"
            aria-selected={mine === value}
            onClick={() => setMine(value)}
            className={cn(
              "min-h-9 rounded-lg px-4 text-sm font-medium transition-colors",
              mine === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            {value ? t("productEditor.tabMine") : t("productEditor.tabAll")}
          </button>
        ))}
      </div>

      {mine ? (
        <MyProducts />
      ) : (
      <>
      <div className="flex flex-wrap gap-2">
        <input
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          placeholder={t("productEditor.search")}
          aria-label={t("productEditor.search")}
          className="h-10 min-w-48 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <select value={condition} onChange={(event) => setCondition(event.target.value)} aria-label={t("productEditor.conditionLabel")} className="h-10 rounded-xl border border-border bg-background px-2 text-sm">
          <option value="">{t("productEditor.conditionLabel")}</option>
          <option value="new">{t("productEditor.condition.new")}</option>
          <option value="used">{t("productEditor.condition.used")}</option>
          <option value="refurbished">{t("productEditor.condition.refurbished")}</option>
        </select>
        <select value={seller} onChange={(event) => setSeller(event.target.value)} aria-label={t("productEditor.sellerType")} className="h-10 rounded-xl border border-border bg-background px-2 text-sm">
          <option value="">{t("productEditor.sellerType")}</option>
          <option value="business">{t("productEditor.sellerBusiness")}</option>
          <option value="personal">{t("productEditor.sellerPersonal")}</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={t("productEditor.sort")} className="h-10 rounded-xl border border-border bg-background px-2 text-sm">
          <option value="newest">{t("productEditor.sortNewest")}</option>
          <option value="price_asc">{t("productEditor.sortPriceAsc")}</option>
          <option value="price_desc">{t("productEditor.sortPriceDesc")}</option>
        </select>
      </div>
      <p className="text-xs text-muted-foreground">{t("productEditor.resultCount", { count: page.data?.total ?? 0 })}</p>

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
        <EmptyState
          icon={ShoppingBag}
          title={t("noProducts")}
          description={t("marketplaceEmptyCta")}
          action={<Link to="/explore"><Button variant="outline" size="sm">{t("explore")}</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setSelected(product)}
              className="h-full min-w-0 text-start rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <ProductCard product={product} className="h-full" />
            </button>
          ))}
        </div>
      )}
      </>
      )}

      {selected && (
        <ProductDetailModal
          product={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: ["product-page"] });
            void queryClient.invalidateQueries({ queryKey: ["products"] });
            void queryClient.invalidateQueries({ queryKey: ["my-products"] });
          }}
        />
      )}

      <CreateProductModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ["product-page"] });
          void queryClient.invalidateQueries({ queryKey: ["products"] });
          void queryClient.invalidateQueries({ queryKey: ["my-products"] });
        }}
      />
    </div>
  );
}
