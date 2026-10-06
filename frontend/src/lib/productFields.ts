/**
 * Which listing fields make sense for each shop category, and what they are called there.
 * The editor shows only these fields and saves the rest empty; the product page shows the same set.
 */

export const PRODUCT_CATEGORIES = ["vehicles", "spareParts", "accessories", "other"] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type ProductField = "fitMake" | "fitModel" | "yearFrom" | "yearTo" | "brand" | "sku" | "ships";

export const CONDITIONS = ["new", "used", "refurbished"] as const;

interface CategoryFields {
  fields: readonly ProductField[];
  /** i18n keys for the editor inputs, where they differ from the default. */
  labels: Partial<Record<ProductField, string>>;
  conditions: readonly (typeof CONDITIONS)[number][];
}

const DEFAULT_LABELS: Record<ProductField, string> = {
  fitMake: "productEditor.fitMake",
  fitModel: "productEditor.fitModel",
  yearFrom: "productEditor.yearFrom",
  yearTo: "productEditor.yearTo",
  brand: "productEditor.brand",
  sku: "productEditor.sku",
  ships: "productEditor.ships",
};

const PARTS: CategoryFields = {
  fields: ["fitMake", "fitModel", "yearFrom", "yearTo", "brand", "sku", "ships"],
  labels: {},
  conditions: CONDITIONS,
};

export const CATEGORY_FIELDS: Record<ProductCategory, CategoryFields> = {
  // A vehicle for sale: its own make, model and year. No SKU, brand or shipping.
  vehicles: {
    fields: ["fitMake", "fitModel", "yearFrom"],
    labels: { fitMake: "productEditor.vehicleMake", fitModel: "productEditor.vehicleModel", yearFrom: "productEditor.vehicleYear" },
    conditions: ["new", "used"],
  },
  spareParts: PARTS,
  accessories: PARTS,
  other: { fields: ["brand", "ships"], labels: {}, conditions: CONDITIONS },
};

export function categoryFields(category: string | null | undefined): CategoryFields {
  return CATEGORY_FIELDS[(PRODUCT_CATEGORIES as readonly string[]).includes(category ?? "") ? (category as ProductCategory) : "other"];
}

export function fieldLabel(category: string, field: ProductField): string {
  return categoryFields(category).labels[field] ?? DEFAULT_LABELS[field];
}
