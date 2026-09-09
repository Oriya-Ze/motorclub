import { Building2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ALL_BUSINESS_TYPES, type BusinessUpgradeFormData } from "@/lib/businessTypes";

interface BusinessUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BusinessUpgradeFormData) => void;
  isSubmitting: boolean;
  defaultContactName?: string;
}

export default function BusinessUpgradeModal({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  defaultContactName = "",
}: BusinessUpgradeModalProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    business_name: "",
    business_type: "garage" as BusinessUpgradeFormData["business_type"],
    business_phone: "",
    business_address: "",
    business_description: "",
    contact_full_name: defaultContactName,
    contact_phone: "",
    business_registration_id: "",
    business_website: "",
    additional_notes: "",
  });

  if (!open) return null;

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      business_name: form.business_name.trim(),
      business_type: form.business_type,
      business_phone: form.business_phone.trim(),
      business_address: form.business_address.trim(),
      business_description: form.business_description.trim(),
      contact_full_name: form.contact_full_name.trim(),
      contact_phone: form.contact_phone.trim(),
      business_registration_id: form.business_registration_id.trim() || undefined,
      business_website: form.business_website.trim() || undefined,
      additional_notes: form.additional_notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label={t("cancel")} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-glow">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-border/50 bg-card/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="font-display text-lg tracking-wide">{t("businessUpgradeForm.title")}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <p className="text-sm text-muted-foreground">{t("businessUpgradeForm.subtitle")}</p>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("businessUpgradeForm.businessSection")}</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.businessName")}</label>
              <Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.category")}</label>
              <select
                value={form.business_type}
                onChange={(e) => set("business_type", e.target.value)}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
                required
              >
                <optgroup label={t("businessUpgradeForm.workshopGroup")}>
                  {ALL_BUSINESS_TYPES.filter((tpe) =>
                    ["garage", "mechanic", "body_shop", "tires", "electric"].includes(tpe)
                  ).map((type) => (
                    <option key={type} value={type}>{t(`businessCategories.${type}`)}</option>
                  ))}
                </optgroup>
                <optgroup label={t("businessUpgradeForm.serviceGroup")}>
                  {ALL_BUSINESS_TYPES.filter((tpe) =>
                    !["garage", "mechanic", "body_shop", "tires", "electric"].includes(tpe)
                  ).map((type) => (
                    <option key={type} value={type}>{t(`businessCategories.${type}`)}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.businessPhone")}</label>
              <Input value={form.business_phone} onChange={(e) => set("business_phone", e.target.value)} required dir="ltr" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.businessAddress")}</label>
              <Input value={form.business_address} onChange={(e) => set("business_address", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.businessDescription")}</label>
              <textarea
                value={form.business_description}
                onChange={(e) => set("business_description", e.target.value)}
                required
                minLength={10}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
                placeholder={t("businessUpgradeForm.businessDescriptionPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.registrationId")}</label>
              <Input
                value={form.business_registration_id}
                onChange={(e) => set("business_registration_id", e.target.value)}
                placeholder={t("businessUpgradeForm.registrationIdPlaceholder")}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.website")}</label>
              <Input
                value={form.business_website}
                onChange={(e) => set("business_website", e.target.value)}
                placeholder="https://"
                dir="ltr"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("businessUpgradeForm.contactSection")}</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.contactName")}</label>
              <Input value={form.contact_full_name} onChange={(e) => set("contact_full_name", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("businessUpgradeForm.contactPhone")}</label>
              <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} required dir="ltr" />
            </div>
          </section>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("businessUpgradeForm.additionalNotes")}</label>
            <textarea
              value={form.additional_notes}
              onChange={(e) => set("additional_notes", e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          <p className="text-xs text-muted-foreground">{t("businessUpgradeForm.reviewNote")}</p>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? t("businessUpgradeForm.submitting") : t("businessUpgradeForm.submit")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
