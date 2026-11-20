import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

const REASONS = ["spam", "harassment", "sexual_or_violence", "impersonation", "fraud", "irrelevant"] as const;
/** A vehicle card is reported for its content only; the server accepts just these two. */
const VEHICLE_REASONS = ["wrong_info", "irrelevant"] as const;

export default function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: "post" | "profile" | "product" | "story" | "vehicle";
  targetId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const reasons: readonly string[] = targetType === "vehicle" ? VEHICLE_REASONS : REASONS;
  const [reason, setReason] = useState<string>(reasons[0]);
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [hidePost, setHidePost] = useState(true);
  const queryClient = useQueryClient();
  const isPost = targetType === "post";
  // A member who already reported this sees that, instead of the form again.
  const mine = useQuery({
    queryKey: ["my-report", targetType, targetId],
    queryFn: () => api.getMyReport(targetType, targetId),
    staleTime: 0,
  });
  const already = mine.data?.reported ? mine.data : null;
  const stillOpen = already && (already.status === "new" || already.status === "reviewing");
  const refreshLists = () => {
    for (const key of [["posts"], ["explore-posts"], ["explore-search"], ["my-report", targetType, targetId]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const hideOnly = async () => {
    setPending(true);
    try {
      // The open report is found again on the server (duplicate), and the post is hidden for this member.
      await api.createReport({ target_type: targetType, target_id: targetId, reason: "irrelevant", hide_post: true });
      refreshLists();
      toast.success(t("reports.hiddenNow"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reports.failed"));
    } finally {
      setPending(false);
    }
  };

  const submit = async () => {
    setPending(true);
    try {
      const result = await api.createReport({
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details.trim() || undefined,
        hide_post: isPost && hidePost,
      });
      if (isPost && hidePost) {
        // The lists that leave hidden posts out are fetched again, so the post goes away right now.
        refreshLists();
        toast.success(t("reports.sentHidden"));
      } else {
        void queryClient.invalidateQueries({ queryKey: ["my-report", targetType, targetId] });
        toast.success(result.duplicate ? t("reports.duplicate") : t("reports.sent"));
      }
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
        {mine.isLoading ? (
          <p className="text-sm text-muted-foreground" role="status">{t("loading")}</p>
        ) : already ? (
          <>
            <p className="text-sm" role="status">
              {t(stillOpen ? "reports.already" : "reports.alreadyHandled", {
                date: already.created_at ? new Date(already.created_at).toLocaleDateString("he-IL") : "",
              })}
            </p>
            {isPost && already.hidden && <p className="text-sm text-muted-foreground">{t("reports.hiddenAlready")}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>{t("reports.close")}</Button>
              {isPost && stillOpen && !already.hidden && (
                <Button type="button" className="!shadow-none" disabled={pending} onClick={() => void hideOnly()}>
                  {t("reports.hideNow")}
                </Button>
              )}
            </div>
          </>
        ) : (
        <>
        <label className="block text-sm" htmlFor="report-reason">{t("reports.reason")}</label>
        <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
          {reasons.map((item) => (
            <option key={item} value={item}>{t(`reports.reasons.${item}`)}</option>
          ))}
        </select>
        <label className="block text-sm" htmlFor="report-details">{t("reports.details")}</label>
        <textarea id="report-details" value={details} onChange={(event) => setDetails(event.target.value)} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
        {isPost && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={hidePost}
              onChange={(event) => setHidePost(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
              aria-describedby="report-hide-hint"
            />
            <span>
              {t("reports.hidePost")}
              <span id="report-hide-hint" className="block text-xs text-muted-foreground">{t("reports.hidePostHint")}</span>
            </span>
          </label>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t("crop.cancel")}</Button>
          <Button type="button" className="!shadow-none" disabled={pending} onClick={() => void submit()}>
            {pending ? t("reports.sending") : t("reports.submit")}
          </Button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
