import { Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { api, VehicleModCategory, VehicleModItem } from "@/lib/api";
import { cn, displayName, formatHandle } from "@/lib/utils";

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
              selected={item.shop}
              disabled={disabled}
              onSelect={(shop) =>
                update(index, {
                  shop_id: shop?.id ?? null,
                  shop: shop,
                })
              }
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
  selected,
  onSelect,
  disabled,
}: {
  selected?: VehicleModItem["shop"];
  onSelect: (shop: VehicleModItem["shop"] | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["business-search", debounced],
    queryFn: () => api.getBusinesses({ q: debounced }),
    enabled: debounced.length >= 1 && !selected,
  });

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
        <Avatar
          user={{ id: selected.id, full_name: selected.full_name, profile_picture_url: selected.profile_picture_url }}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{displayName(selected)}</p>
          <p className="text-xs text-muted-foreground truncate">
            {selected.business_type
              ? t(`businessCategories.${selected.business_type}`, { defaultValue: formatHandle(selected) })
              : formatHandle(selected)}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            onSelect(null);
            setQuery("");
            setDebounced("");
          }}
          className="p-1 text-muted-foreground hover:text-foreground"
          aria-label={t("garage.clearShop")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const showDropdown = open && debounced.length >= 1;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          disabled={disabled}
          placeholder={t("garage.searchShop")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={cn(
            "flex h-11 w-full rounded-xl border border-input bg-background/50 ps-9 pe-9 py-2 text-sm",
            "text-foreground placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        {query && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setQuery("");
              setDebounced("");
              setOpen(false);
            }}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 w-full z-50 glass-card rounded-xl border border-border/50 shadow-lg overflow-hidden">
          {isFetching ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t("noSearchResults")}</p>
          ) : (
            <ul className="max-h-64 overflow-y-auto">
              {results.map((shop) => (
                <li key={shop.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-start"
                    onClick={() => {
                      onSelect({
                        id: shop.id,
                        full_name: shop.full_name,
                        username: shop.username,
                        business_type: shop.business_type,
                        profile_picture_url: shop.profile_picture_url,
                      });
                      setQuery("");
                      setDebounced("");
                      setOpen(false);
                    }}
                  >
                    <Avatar user={shop} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{displayName(shop)}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {shop.business_type
                          ? t(`businessCategories.${shop.business_type}`, { defaultValue: formatHandle(shop) })
                          : formatHandle(shop)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
