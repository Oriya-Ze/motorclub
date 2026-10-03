import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AdminCard, AdminEmpty, AdminLoading, AdminSection, ReasonAction, formatDateTime } from "@/pages/admin/shared";

const REASON_CODES: Record<string, string> = {
  explicit_nudity: "עירום מפורש",
  violence: "אלימות",
  graphic_violence: "אלימות גרפית",
  hate_symbols: "סמלי שנאה",
  animation: "אנימציה",
  removed_by_moderator: "הוסר על ידי צוות",
};

export default function AdminAppeals() {
  const queryClient = useQueryClient();
  const appeals = useQuery({ queryKey: ["admin-appeals"], queryFn: () => api.getAppeals() });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-appeals"] });
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  return (
    <AdminSection title="ערעורים" description="בקשות לבדיקה נוספת של פוסט שנחסם. אישור מתייחס רק לגרסה שנחסמה.">
      {appeals.isLoading ? (
        <AdminLoading />
      ) : !appeals.data?.length ? (
        <AdminEmpty>אין ערעורים פתוחים.</AdminEmpty>
      ) : (
        <div className="space-y-3">
          {appeals.data.map((appeal) => (
            <AdminCard key={appeal.id}>
              <p className="text-sm text-muted-foreground">{formatDateTime(appeal.created_at)}</p>
              <p className="text-sm">
                סיבות החסימה: {appeal.snapshot.map((item) => (item.reason_code ? REASON_CODES[item.reason_code] ?? item.reason_code : item.decision)).join(", ") || "לא צוין"}
              </p>
              {appeal.note && <p className="mt-1 text-sm">«{appeal.note}»</p>}
              <a className="text-sm text-primary underline" href={`/posts/${appeal.post_id}`} target="_blank" rel="noreferrer">פתיחת הפוסט (גלוי לצוות)</a>
              <div className="mt-3 flex flex-wrap gap-2">
                <ReasonAction label="אישור ופרסום" variant="default" onSubmit={async (reason) => { const r = await api.reviewAppeal(appeal.id, "approved", reason); toast.success(r.status === "stale" ? "הערעור התייחס לגרסה ישנה ולא פורסם" : "הערעור אושר"); refresh(); }} />
                <ReasonAction label="דחייה" variant="destructive" onSubmit={async (reason) => { await api.reviewAppeal(appeal.id, "denied", reason); toast.success("הערעור נדחה"); refresh(); }} />
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
