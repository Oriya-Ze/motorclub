import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

const REASONS = ["spam", "harassment", "sexual_or_violence", "impersonation", "fraud", "irrelevant"] as const;

export default function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: "post" | "profile" | "product" | "story";
  targetId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string>("spam");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    try {
      const result = await api.createReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success(result.duplicate ? t("reports.duplicate") : t("reports.sent"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reports.failed"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label={t("composer.close")} onClick={onClose} />
      <div className="relative w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 id="report-title" className="text-lg font-semibold">{t("reports.title")}</h2>
        <label className="block text-sm" htmlFor="report-reason">{t("reports.reason")}</label>
        <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
          {REASONS.map((item) => (
            <option key={item} value={item}>{t(`reports.reasons.${item}`)}</option>
          ))}
        </select>
        <label className="block text-sm" htmlFor="report-details">{t("reports.details")}</label>
        <textarea id="report-details" value={details} onChange={(event) => setDetails(event.target.value)} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t("crop.cancel")}</Button>
          <Button type="button" className="!shadow-none" disabled={pending} onClick={() => void submit()}>
            {pending ? t("reports.sending") : t("reports.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
