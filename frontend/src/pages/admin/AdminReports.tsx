import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { AdminReportGroup } from "@/lib/adminTypes";
import { mediaUrl } from "@/lib/media";
import { AdminCard, AdminEmpty, AdminLoading, AdminSection, FilterTabs, REPORT_REASONS, ReasonAction, TARGET_LABELS, formatDateTime } from "@/pages/admin/shared";

type Status = "new" | "resolved" | "dismissed";

export default function AdminReports() {
  const [status, setStatus] = useState<Status>("new");
  const queryClient = useQueryClient();
  const reports = useQuery({ queryKey: ["admin-reports", status], queryFn: () => api.getReports({ status }) });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const closeAll = async (group: AdminReportGroup, next: "resolved" | "dismissed", reason: string) => {
    for (const report of group.reports) await api.updateReport(report.id, { status: next, reason });
    toast.success(next === "resolved" ? "הדיווחים סומנו כמטופלים" : "הדיווחים נסגרו");
    refresh();
  };

  return (
    <AdminSection title="דיווחים" description="דיווחים מקובצים לפי מה שדווח. אפשר להסתיר את התוכן ואז לסגור את הדיווחים.">
      <FilterTabs
        label="סטטוס דיווח"
        value={status}
        onChange={setStatus}
        options={[
          { value: "new", label: "פתוחים" },
          { value: "resolved", label: "טופלו" },
          { value: "dismissed", label: "נסגרו בלי פעולה" },
        ]}
      />
      {reports.isLoading ? (
        <AdminLoading />
      ) : !reports.data?.items.length ? (
        <AdminEmpty>אין דיווחים בסטטוס הזה.</AdminEmpty>
      ) : (
        <div className="space-y-3">
          {reports.data.items.map((group) => {
            const target = group.target;
            return (
              <AdminCard key={`${group.target_type}-${group.target_id}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{TARGET_LABELS[group.target_type] ?? group.target_type}</span>
                  <span className="font-semibold">{group.count} דיווחים</span>
                  <span className="text-muted-foreground">אחרון: {formatDateTime(group.latest)}</span>
                  <span className="text-muted-foreground">· {group.reasons.map((r) => REPORT_REASONS[r] ?? r).join(", ")}</span>
                </div>

                {target ? (
                  <div className="mt-3 flex gap-3 rounded-xl bg-muted/30 p-3">
                    {target.image && mediaUrl(target.image) && (
                      <img src={mediaUrl(target.image)} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 text-sm">
                      <p className="text-muted-foreground">
                        {target.author ? `@${target.author}` : ""}
                        {target.has_video ? " · כולל וידאו" : ""}
                        {target.hidden ? " · מוסתר" : ""}
                        {target.suspended ? " · מושעה" : ""}
                      </p>
                      {target.text && <p className="line-clamp-3 whitespace-pre-wrap">{target.text}</p>}
                      <a className="text-primary underline" href={target.link} target="_blank" rel="noreferrer">פתיחה באפליקציה</a>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">התוכן כבר לא קיים.</p>
                )}

                <ul className="mt-3 space-y-1 text-sm">
                  {group.reports.map((report) => (
                    <li key={report.id} className="text-muted-foreground">
                      {formatDateTime(report.created_at)} · {REPORT_REASONS[report.reason] ?? report.reason}
                      {report.details ? ` · "${report.details}"` : ""}
                    </li>
                  ))}
                </ul>

                {status === "new" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {target && !target.hidden && group.target_type === "post" && (
                      <ReasonAction
                        label="הסתרת הפוסט"
                        variant="destructive"
                        onSubmit={async (reason) => {
                          await api.setPostVisibility(group.target_id, true, reason);
                          await closeAll(group, "resolved", reason);
                        }}
                      />
                    )}
                    {target && !target.hidden && group.target_type === "product" && (
                      <ReasonAction
                        label="הסתרת המוצר"
                        variant="destructive"
                        onSubmit={async (reason) => {
                          await api.setProductVisibility(group.target_id, true, reason);
                          await closeAll(group, "resolved", reason);
                        }}
                      />
                    )}
                    {target?.author && (
                      <Link to={`/admin/accounts?q=${encodeURIComponent(target.author)}`} className="inline-flex h-9 items-center rounded-xl border border-border px-4 text-sm hover:bg-muted">
                        לחשבון של @{target.author}
                      </Link>
                    )}
                    <ReasonAction label="סימון כמטופל" onSubmit={(reason) => closeAll(group, "resolved", reason)} />
                    <ReasonAction label="סגירה בלי פעולה" variant="ghost" onSubmit={(reason) => closeAll(group, "dismissed", reason)} />
                  </div>
                )}
              </AdminCard>
            );
          })}
        </div>
      )}
    </AdminSection>
  );
}
