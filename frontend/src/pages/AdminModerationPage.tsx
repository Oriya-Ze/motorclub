import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { API_BASE } from "@/lib/media";

export default function AdminModerationPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [postId, setPostId] = useState("");
  const [productId, setProductId] = useState("");
  const overview = useQuery({
    queryKey: ["moderation-overview"],
    queryFn: () => api.getModerationOverview(),
    enabled: Boolean(user?.is_admin || user?.is_moderator),
  });
  const scans = useQuery({
    queryKey: ["moderation-scans"],
    queryFn: () => api.getMediaScans("needs_review"),
    enabled: Boolean(user?.is_admin || user?.is_moderator),
  });
  const accounts = useQuery({
    queryKey: ["moderation-users", userQuery],
    queryFn: () => api.searchModerationUsers(userQuery),
    enabled: Boolean(user?.is_admin || user?.is_moderator),
  });
  const reports = useQuery({
    queryKey: ["moderation-reports"],
    queryFn: () => api.getReports(),
    enabled: Boolean(user?.is_admin || user?.is_moderator),
  });

  if (!user?.is_admin && !user?.is_moderator) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <h1 className="text-2xl font-semibold">{t("moderation.title")}</h1>
      <section className="grid gap-3 sm:grid-cols-2">
        <Stat label={t("moderation.openReports")} value={overview.data?.open_reports} />
        <Stat label={t("moderation.pendingImages")} value={overview.data?.pending_products} />
        <Stat label={t("moderation.scanErrors")} value={overview.data?.scan_errors} />
        <Stat label={t("moderation.newReports")} value={overview.data?.new_reports} />
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t("moderation.imageQueue")}</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => void api.retryMediaScans().then(() => scans.refetch())}>{t("moderation.retry")}</Button>
        </div>
        {(scans.data ?? []).map((scan) => (
          <article key={scan.id} className="rounded-2xl border border-border p-3 text-sm">
            <p className="text-xs text-muted-foreground">{scan.decision} · {(scan.labels || []).map((label) => `${label.name} ${label.confidence}`).join(", ")}</p>
            <button type="button" className="mt-2 text-xs underline" onClick={() => setRevealed(revealed === scan.id ? null : scan.id)}>
              {revealed === scan.id ? t("moderation.hideImage") : t("moderation.reveal")}
            </button>
            {revealed === scan.id && <p className="mt-2 break-all text-xs">{scan.storage_key}</p>}
            <PrivatePreview storageKey={scan.storage_key} revealed={revealed === scan.id} />
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" onClick={() => void api.reviewMediaScan(scan.id, "approved", reason || t("moderation.approvedReason")).then(() => scans.refetch())}>{t("moderation.approve")}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void api.reviewMediaScan(scan.id, "rejected", reason || t("moderation.rejectedReason")).then(() => scans.refetch())}>{t("moderation.reject")}</Button>
            </div>
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">{t("moderation.accounts")}</h2>
        <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder={t("moderation.searchAccounts")} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" />
        {(accounts.data ?? []).map((account) => (
          <div key={account.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2 text-sm">
            <span className="flex-1">{account.full_name} · {account.account_type}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void api.setUserSuspension(account.id, account.suspended_until ? null : 7, reason || t("moderation.suspendReason")).then(() => accounts.refetch())}>
              {account.suspended_until ? t("moderation.release") : t("moderation.suspend")}
            </Button>
            {account.account_type === "business" && (
              <Button type="button" size="sm" variant="outline" onClick={() => void api.setBusinessVisibility(account.id, !account.business_hidden, reason || t("moderation.suspendReason")).then(() => accounts.refetch())}>
                {account.business_hidden ? t("moderation.restore") : t("moderation.hide")}
              </Button>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input value={postId} onChange={(event) => setPostId(event.target.value)} placeholder={t("moderation.postId")} className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm" />
          <Button type="button" size="sm" variant="outline" onClick={() => void api.setPostVisibility(postId, true, reason || t("moderation.suspendReason"))}>{t("moderation.hidePost")}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void api.setPostVisibility(postId, false, reason || t("moderation.suspendReason"))}>{t("moderation.restorePost")}</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={productId} onChange={(event) => setProductId(event.target.value)} placeholder={t("moderation.productId")} className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm" />
          <Button type="button" size="sm" variant="outline" onClick={() => void api.setProductVisibility(productId, true, reason || t("moderation.suspendReason"))}>{t("moderation.hideProduct")}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void api.setProductVisibility(productId, false, reason || t("moderation.suspendReason"))}>{t("moderation.restoreProduct")}</Button>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">{t("moderation.reports")}</h2>
        {(reports.data?.items ?? []).map((group) => {
          const item = group as { target_type: string; target_id: string; count: number; reasons: string[]; reports: Array<{ id: string; status: string; reason: string }> };
          const first = item.reports?.[0];
          return (
            <article key={`${item.target_type}-${item.target_id}`} className="rounded-2xl border border-border p-3 text-sm">
              <p>{item.target_type} · {item.count} · {(item.reasons || []).join(", ")}</p>
              {first && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("reports.details")} className="h-9 flex-1 rounded-lg border border-border bg-background px-2" />
                  <Button type="button" size="sm" variant="outline" onClick={() => {
                    if (!reason.trim()) return;
                    void api.updateReport(first.id, { status: "dismissed", reason }).then(() => {
                      toast.success(t("reports.sent"));
                      void reports.refetch();
                      void overview.refetch();
                    }).catch((err: Error) => toast.error(err.message));
                  }}>{t("moderation.dismiss")}</Button>
                  <Button type="button" size="sm" onClick={() => {
                    if (!reason.trim()) return;
                    void api.updateReport(first.id, { status: "resolved", reason }).then(() => {
                      toast.success(t("reports.sent"));
                      void reports.refetch();
                    }).catch((err: Error) => toast.error(err.message));
                  }}>{t("moderation.resolve")}</Button>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function PrivatePreview({ storageKey, revealed }: { storageKey: string; revealed: boolean }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!revealed) return;
    let stop = false;
    api.mediaAccessUrl(storageKey).then(async (result) => {
      const target = result.url.startsWith("/") ? `${API_BASE}${result.url}` : result.url;
      if (result.url.startsWith("http")) {
        if (!stop) setSrc(target);
        return;
      }
      const response = await fetch(target, { headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` } });
      if (!response.ok) throw new Error("preview failed");
      if (!stop) setSrc(URL.createObjectURL(await response.blob()));
    }).catch(() => {
      if (!stop) setSrc("");
    });
    return () => {
      stop = true;
    };
  }, [revealed, storageKey]);
  return (
    <div className={revealed ? "" : "pointer-events-none blur-xl"}>
      {src ? <img src={src} alt="" className="mt-2 h-24 object-contain" /> : <div className="mt-2 h-24 rounded-lg bg-muted" />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-2xl font-semibold">{value ?? "—"}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
