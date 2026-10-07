import { useTranslation } from "react-i18next";
import BusinessListingBadge from "@/components/BusinessListingBadge";
import Avatar from "@/components/Avatar";
import FitImage from "@/components/FitImage";
import StoredImage from "@/components/StoredImage";
import { Product } from "@/lib/api";
import { pickStoredImageUrl } from "@/lib/postMedia";
import { cn } from "@/lib/utils";

export function formatIls(price: number): string {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(price);
}

export default function ProductCard({
  product,
  className,
  imageSrc,
}: {
  product: Product;
  className?: string;
  /** An on-device preview of the first photo, used by the editor before the processed copy exists. */
  imageSrc?: string;
}) {
  const { t } = useTranslation();
  const image = product.image_urls?.[0];
  const seller = product.seller;
  return (
    <article className={cn("flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className={cn("relative aspect-square overflow-hidden", image ? "bg-black" : "bg-muted/40")}>
        {image ? (
          imageSrc ? (
            <FitImage src={imageSrc} alt="" className="absolute inset-0 h-full w-full" />
          ) : (
            <StoredImage
              sourceKey={image}
              preferredKey={pickStoredImageUrl(image, null, "detail")}
              className="absolute inset-0 h-full w-full"
              loading="lazy"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{t("productEditor.noPhoto")}</div>
        )}
        {seller?.account_type === "business" && <BusinessListingBadge className="absolute top-2 start-2" />}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</h3>
        <p className="text-lg font-semibold text-primary">{formatIls(product.price)}</p>
        <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
          {product.condition && <span>{t(`productEditor.condition.${product.condition}`)}</span>}
          {product.pickup_area && <span>{product.pickup_area}</span>}
        </div>
        {seller && (
          <div className="mt-auto flex items-center gap-2 pt-1">
            <Avatar user={seller} size="xs" />
            <span className="truncate text-xs">{seller.full_name}</span>
          </div>
        )}
      </div>
    </article>
  );
}
