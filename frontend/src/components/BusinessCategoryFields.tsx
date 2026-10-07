import { Building2, Check, UserRound } from "lucide-react";
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

const ENTITY_ICONS: Record<BusinessEntity, typeof UserRound> = { self_employed: UserRound, company: Building2 };

/** A round mark that fills with the brand color and a check when selected. */
function CheckMark({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-primary/70",
        className,
      )}
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3.5} /> : null}
    </span>
  );
}

/**
 * Whether the business is self-employed or a company, then its categories (several allowed, the first picked
 * is the primary one). Shared by the upgrade request and the business settings.
 * Native checkboxes and radios stay in place, visually hidden, so keyboards and screen readers work.
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
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("businessUpgradeForm.entity")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {BUSINESS_ENTITIES.map((value) => {
            const Icon = ENTITY_ICONS[value];
            const checked = entity === value;
            return (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-entity`}
                  value={value}
                  checked={checked}
                  onChange={() => onEntityChange(value)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "flex h-full items-center gap-3 rounded-2xl border p-3 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                    checked ? "border-primary bg-primary/10" : errors?.entity ? "border-destructive/60 hover:bg-muted/40" : "border-border hover:bg-muted/40",
                  )}
                >
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t(`businessUpgradeForm.entity_${value}`)}</span>
                    <span className="block text-xs text-muted-foreground">{t(`businessUpgradeForm.entityHint_${value}`)}</span>
                  </span>
                  <CheckMark checked={checked} />
                </span>
              </label>
            );
          })}
        </div>
        {errors?.entity ? <p className="text-xs text-destructive" role="alert">{errors.entity}</p> : null}
      </fieldset>

      <fieldset className="space-y-2" aria-describedby={`${id}-types-hint`}>
        <legend className="text-sm font-medium">{t("businessUpgradeForm.category")}</legend>
        <p id={`${id}-types-hint`} className="text-xs text-muted-foreground">{t("businessUpgradeForm.categoryHint")}</p>
        <div className={cn("space-y-3 rounded-2xl border bg-background/40 p-3", errors?.types ? "border-destructive/60" : "border-border")}>
          {GROUPS.map((group, index) => (
            <div key={group.label} className={cn("space-y-1", index > 0 && "border-t border-border/60 pt-3")}>
              <p className="px-1 text-xs font-semibold text-muted-foreground">{t(group.label)}</p>
              <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                {group.types.map((type) => {
                  const checked = types.includes(type);
                  return (
                    <label key={type} className="cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggle(type)} className="peer sr-only" />
                      <span
                        className={cn(
                          "flex min-h-10 items-center gap-2 rounded-xl px-1.5 py-1.5 text-sm leading-tight transition-colors hover:bg-muted/50",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                          checked ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <CheckMark checked={checked} />
                        <span className="min-w-0">
                          {t(`businessCategories.${type}`)}
                          {checked && types[0] === type && types.length > 1 ? (
                            <span className="ms-1.5 inline-block rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
                              {t("businessUpgradeForm.primary")}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {errors?.types ? <p className="text-xs text-destructive" role="alert">{errors.types}</p> : null}
      </fieldset>
    </>
  );
}
