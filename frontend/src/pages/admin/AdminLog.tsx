import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AdminEmpty, AdminLoading, AdminSection, TARGET_LABELS, appLink, formatDateTime } from "@/pages/admin/shared";

const ACTIONS: Record<string, string> = {
  hide_post: "הסתרת פוסט",
  restore_post: "החזרת פוסט",
  hide_product: "הסתרת מוצר",
  restore_product: "החזרת מוצר",
  suspend_user: "השעיית חשבון",
  unsuspend_user: "ביטול השעיה",
  delete_user: "מחיקת חשבון",
  grant_admin: "מינוי מנהל מערכת",
  revoke_admin: "הסרת מנהל מערכת",
  grant_moderator: "מינוי מודרטור",
  revoke_moderator: "הסרת מודרטור",
  verify_user: "סימון כמאומת",
  unverify_user: "הסרת אימות",
  image_approved: "אישור תמונה",
  image_rejected: "דחיית תמונה",
  video_approved: "אישור סרטון",
  video_rejected: "דחיית סרטון",
  report_resolved: "דיווח טופל",
  report_dismissed: "דיווח נסגר",
  appeal_approved: "ערעור אושר",
  appeal_denied: "ערעור נדחה",
  appeal_stale: "ערעור על גרסה ישנה",
  retry_scans: "סריקה חוזרת",
};

export default function AdminLog() {
  const log = useQuery({ queryKey: ["admin-log"], queryFn: () => api.getModerationActions(100) });
  return (
    <AdminSection title="יומן פעולות" description="כל פעולת ניהול נשמרת עם מי שביצע אותה והסיבה.">
      {log.isLoading ? (
        <AdminLoading />
      ) : !log.data?.length ? (
        <AdminEmpty>עדיין אין פעולות.</AdminEmpty>
      ) : (
        <ol className="divide-y divide-border rounded-2xl border border-border bg-card">
          {log.data.map((entry) => {
            const link = appLink(entry.target_type, entry.target_id);
            return (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-sm">
                <span className="text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                <span className="font-medium">{ACTIONS[entry.action] ?? entry.action}</span>
                <span className="text-muted-foreground">
                  {TARGET_LABELS[entry.target_type] ?? entry.target_type}
                  {link && entry.action !== "delete_user" ? (
                    <> · <a className="text-primary underline" href={link} target="_blank" rel="noreferrer">פתיחה</a></>
                  ) : null}
                </span>
                {entry.actor && <span className="text-muted-foreground" dir="ltr">@{entry.actor}</span>}
                {entry.reason && <span className="basis-full text-muted-foreground">«{entry.reason}»</span>}
              </li>
            );
          })}
        </ol>
      )}
    </AdminSection>
  );
}
