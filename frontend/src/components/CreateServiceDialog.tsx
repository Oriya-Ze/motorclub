import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { getBusinessProfilePath } from "@/lib/businessProfile";
import { decimalOnly } from "@/lib/numericInput";

/** A business adds a service from the services page; it then shows on the services tab of its profile. */
export default function CreateServiceDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = useId();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = useMutation({
    mutationFn: () =>
      api.createBusinessService({
        name: name.trim(),
        description: description.trim() || undefined,
        price_from: price ? Number(price) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-business-services"] });
      queryClient.invalidateQueries({ queryKey: ["business-services"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      const profile = user ? `${getBusinessProfilePath(user.business_type, user.id)}?tab=services` : null;
      toast.success(t("businessSettings.serviceCreated"), profile
        ? { action: { label: t("businessSettings.viewPublicProfile"), onClick: () => navigate(profile) } }
        : undefined);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || create.isPending) return;
    create.mutate();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <button type="button" className="absolute inset-0 bg-black/60" aria-label={t("composer.close")} onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-4" noValidate>
        <h2 id={`${id}-title`} className="text-lg font-semibold">{t("businessSettings.addService")}</h2>
        <div className="space-y-1">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">{t("businessSettings.serviceName")}</label>
          <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-price`} className="text-sm font-medium">{t("businessSettings.servicePriceFrom")}</label>
          <Input id={`${id}-price`} value={price} onChange={(e) => setPrice(decimalOnly(e.target.value))} dir="ltr" inputMode="decimal" />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${id}-desc`} className="text-sm font-medium">{t("businessSettings.serviceDescription")}</label>
          <textarea
            id={`${id}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!name.trim() || create.isPending}>{t("businessSettings.addService")}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>{t("cancel")}</Button>
        </div>
      </form>
    </div>
  );
}
