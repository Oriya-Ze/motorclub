import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AdminCard, AdminEmpty, AdminLoading, AdminSection, FilterTabs, ReasonAction, formatDateTime } from "@/pages/admin/shared";

type Status = "pending" | "approved" | "rejected";

export default function AdminBusiness() {
  const [status, setStatus] = useState<Status>("pending");
  const queryClient = useQueryClient();
  const requests = useQuery({ queryKey: ["admin-business", status], queryFn: () => api.listBusinessUpgradeRequests(status) });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-business"] });
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  return (
    <AdminSection title="בקשות לפרופיל עסקי" description="אישור הופך את החשבון לעסקי. דחייה שולחת לפונה את הסיבה.">
      <FilterTabs
        label="סטטוס בקשה"
        value={status}
        onChange={setStatus}
        options={[
          { value: "pending", label: "ממתינות" },
          { value: "approved", label: "אושרו" },
          { value: "rejected", label: "נדחו" },
        ]}
      />
      {requests.isLoading ? (
        <AdminLoading />
      ) : !requests.data?.length ? (
        <AdminEmpty>אין בקשות בסטטוס הזה.</AdminEmpty>
      ) : (
        <div className="space-y-3">
          {requests.data.map((req) => (
            <AdminCard key={req.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{req.business_name}</h2>
                  <p className="text-sm text-muted-foreground">
                    <a className="underline" href={`/profile/${req.user_id}`} target="_blank" rel="noreferrer">@{req.applicant_username}</a>
                    {" · "}
                    <span dir="ltr">{req.applicant_email}</span>
                    {" · "}
                    {formatDateTime(req.created_at)}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">{req.business_type}</span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted-foreground">טלפון עסק: </dt><dd className="inline" dir="ltr">{req.business_phone}</dd></div>
                <div><dt className="inline text-muted-foreground">כתובת: </dt><dd className="inline">{req.business_address}</dd></div>
                <div><dt className="inline text-muted-foreground">איש קשר: </dt><dd className="inline">{req.contact_full_name} · <span dir="ltr">{req.contact_phone}</span></dd></div>
                {req.business_registration_id && <div><dt className="inline text-muted-foreground">ח.פ / ע.מ: </dt><dd className="inline" dir="ltr">{req.business_registration_id}</dd></div>}
                {req.business_website && <div><dt className="inline text-muted-foreground">אתר: </dt><dd className="inline" dir="ltr">{req.business_website}</dd></div>}
              </dl>
              {req.business_description && <p className="mt-2 whitespace-pre-wrap text-sm">{req.business_description}</p>}
              {req.additional_notes && <p className="mt-1 text-sm text-muted-foreground">הערות: {req.additional_notes}</p>}
              {req.rejection_reason && <p className="mt-2 text-sm text-destructive">סיבת דחייה: {req.rejection_reason}</p>}
              {status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ReasonAction
                    label="אישור"
                    variant="default"
                    placeholder="הערה פנימית"
                    onSubmit={async (note) => {
                      await api.approveBusinessUpgrade(req.id, note);
                      toast.success("הבקשה אושרה והחשבון עסקי");
                      refresh();
                    }}
                  />
                  <ReasonAction
                    label="דחייה"
                    variant="destructive"
                    placeholder="סיבה שתוצג לפונה"
                    onSubmit={async (reason) => {
                      await api.rejectBusinessUpgrade(req.id, reason);
                      toast.success("הבקשה נדחתה");
                      refresh();
                    }}
                  />
                </div>
              )}
            </AdminCard>
          ))}
        </div>
      )}
    </AdminSection>
  );
}
