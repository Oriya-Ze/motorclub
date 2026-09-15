import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { api, VehicleModCategory, VehicleModItem } from "@/lib/api";

const CATEGORIES: VehicleModCategory[] = ["engine", "suspension", "exterior", "audio", "other"];

function emptyItem(): VehicleModItem {
  return {
    id: crypto.randomUUID(),
    category: "other",
    name: "",
    brand: "",
    shop_id: null,
    shop: null,
  };
}

type Props = {
  items: VehicleModItem[];
  onChange: (items: VehicleModItem[]) => void;
  disabled?: boolean;
};

export default function VehicleModEditor({ items, onChange, disabled }: Props) {
  const { t } = useTranslation();
  const [shopQuery, setShopQuery] = useState<Record<string, string>>({});

  const update = (index: number, patch: Partial<VehicleModItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("garage.buildSheet")}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || items.length >= 30}
          onClick={() => onChange([...items, emptyItem()])}
        >
          <Plus className="w-4 h-4 me-1" />
          {t("garage.addMod")}
        </Button>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">{t("garage.modsHint")}</p>
      )}
      {items.map((item, index) => {
        const id = item.id || String(index);
        return (
          <div key={id} className="rounded-xl border border-border/60 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={item.category}
                disabled={disabled}
                onChange={(e) => update(index, { category: e.target.value as VehicleModCategory })}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`garage.modCategory.${cat}`)}
                  </option>
                ))}
              </Select>
              <Input
                value={item.brand ?? ""}
                disabled={disabled}
                placeholder={t("garage.modBrand")}
                onChange={(e) => update(index, { brand: e.target.value })}
              />
              <Input
                className="col-span-2"
                value={item.name}
                disabled={disabled}
                placeholder={t("garage.modName")}
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </div>
            <ShopPicker
              query={shopQuery[id] ?? item.shop?.full_name ?? ""}
              onQueryChange={(q) => setShopQuery((prev) => ({ ...prev, [id]: q }))}
              selected={item.shop}
              disabled={disabled}
              onSelect={(shop) => {
                update(index, {
                  shop_id: shop?.id ?? null,
                  shop: shop,
                });
                setShopQuery((prev) => ({ ...prev, [id]: shop?.full_name ?? "" }));
              }}
            />
            <button
              type="button"
              disabled={disabled}
              className="text-xs text-destructive inline-flex items-center gap-1"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("garage.removeMod")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ShopPicker({
  query,
  onQueryChange,
  selected,
  onSelect,
  disabled,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  selected?: VehicleModItem["shop"];
  onSelect: (shop: VehicleModItem["shop"] | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [] } = useQuery({
    queryKey: ["business-search", debounced],
    queryFn: () => api.getBusinesses({ q: debounced }),
    enabled: debounced.length >= 2 && !selected,
  });

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2">
        <span className="truncate">{t("garage.taggedShop", { name: selected.full_name })}</span>
        <button type="button" disabled={disabled} onClick={() => onSelect(null)} aria-label={t("garage.clearShop")}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Input
        value={query}
        disabled={disabled}
        placeholder={t("garage.searchShop")}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      {debounced.length >= 2 && results.length > 0 && (
        <ul className="border border-border rounded-lg overflow-hidden max-h-36 overflow-y-auto">
          {results.slice(0, 6).map((shop) => (
            <li key={shop.id}>
              <button
                type="button"
                className="w-full text-start px-3 py-2 text-sm hover:bg-muted/60"
                onClick={() =>
                  onSelect({
                    id: shop.id,
                    full_name: shop.full_name,
                    username: shop.username,
                    business_type: shop.business_type,
                  })
                }
              >
                {shop.full_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
