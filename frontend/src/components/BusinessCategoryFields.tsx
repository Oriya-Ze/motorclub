import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  BUSINESS_ENTITIES,
  SERVICE_BUSINESS_TYPES,
  WORKSHOP_BUSINESS_TYPES,
  type BusinessEntity,
  type BusinessType,
} from "@/lib/businessTypes";
import { cn } from "@/lib/utils";

const GROUPS = [
  { label: "businessUpgradeForm.workshopGroup", types: WORKSHOP_BUSINESS_TYPES },
  { label: "businessUpgradeForm.serviceGroup", types: SERVICE_BUSINESS_TYPES },
] as const;

/**
 * The business categories (several allowed, the first picked is the primary one) and whether the
 * business is self-employed or a company. Shared by the upgrade request and the business settings.
 */
export default function BusinessCategoryFields({
  types,
  onTypesChange,
  entity,
  onEntityChange,
  errors,
}: {
  types: BusinessType[];
  onTypesChange: (types: BusinessType[]) => void;
  entity: BusinessEntity | "";
  onEntityChange: (entity: BusinessEntity) => void;
  errors?: { types?: string; entity?: string };
}) {
  const { t } = useTranslation();
  const id = useId();
  const toggle = (type: BusinessType) =>
    onTypesChange(types.includes(type) ? types.filter((item) => item !== type) : [...types, type]);

  return (
    <>
      <fieldset className="space-y-2" aria-describedby={`${id}-types-hint`}>
        <legend className="text-sm font-medium">{t("businessUpgradeForm.category")}</legend>
        <p id={`${id}-types-hint`} className="text-xs text-muted-foreground">{t("businessUpgradeForm.categoryHint")}</p>
        {GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">{t(group.label)}</p>
            <div className="flex flex-wrap gap-2">
              {group.types.map((type) => {
                const checked = types.includes(type);
                return (
                  <label
                    key={type}
                    className={cn(
                      "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
                      checked ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(type)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    {t(`businessCategories.${type}`)}
                    {checked && types[0] === type && types.length > 1 ? (
                      <span className="rounded-full bg-primary/20 px-1.5 text-[11px] font-semibold text-primary">{t("businessUpgradeForm.primary")}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {errors?.types ? <p className="text-xs text-destructive" role="alert">{errors.types}</p> : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("businessUpgradeForm.entity")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS_ENTITIES.map((value) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-ring",
                entity === value ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <input
                type="radio"
                name={`${id}-entity`}
                value={value}
                checked={entity === value}
                onChange={() => onEntityChange(value)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              {t(`businessUpgradeForm.entity_${value}`)}
            </label>
          ))}
        </div>
        {errors?.entity ? <p className="text-xs text-destructive" role="alert">{errors.entity}</p> : null}
      </fieldset>
    </>
  );
}
