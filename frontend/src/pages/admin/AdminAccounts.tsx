import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { AdminUser } from "@/lib/adminTypes";
import { AdminCard, AdminEmpty, AdminLoading, AdminSection, ReasonAction, formatDateTime } from "@/pages/admin/shared";

const SUSPENSION_DAYS = [1, 3, 7, 30, 365];

function Badge({ children, tone = "muted" }: { children: string; tone?: "muted" | "primary" | "warn" }) {
  const cls = tone === "primary" ? "bg-primary/15 text-primary" : tone === "warn" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function AccountRow({ account, isAdmin, selfId, onChanged }: { account: AdminUser; isAdmin: boolean; selfId?: string; onChanged: () => void }) {
  const [days, setDays] = useState(7);
  const daysId = useId();
  const isSelf = account.id === selfId;
  const suspended = account.suspended_until && new Date(account.suspended_until) > new Date();
  const protectedAccount = isSelf || account.is_admin;

  return (
    <AdminCard>
      <div className="flex flex-wrap items-start gap-3">
        <Avatar user={account} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {account.full_name} <span className="font-normal text-muted-foreground" dir="ltr">@{account.username}</span>
          </p>
          {account.email && <p className="text-sm text-muted-foreground" dir="ltr">{account.email}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {account.is_admin && <Badge tone="primary">מנהל מערכת</Badge>}
            {account.is_moderator && <Badge tone="primary">מודרטור</Badge>}
            {account.is_verified && <Badge>מאומת</Badge>}
            {account.account_type === "business" && <Badge>עסק</Badge>}
            {account.business_hidden && <Badge tone="warn">עסק מוסתר</Badge>}
            {suspended && <Badge tone="warn">{`מושעה עד ${formatDateTime(account.suspended_until)}`}</Badge>}
            {isSelf && <Badge>זה את/ה</Badge>}
          </div>
          {account.created_at && <p className="mt-1 text-xs text-muted-foreground">הצטרף/ה {formatDateTime(account.created_at)}</p>}
        </div>
        <a className="text-sm text-primary underline" href={`/profile/${account.id}`} target="_blank" rel="noreferrer">פרופיל</a>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-2">
        {!protectedAccount && !suspended && (
          <div className="flex flex-wrap items-start gap-2">
            <label className="sr-only" htmlFor={daysId}>משך ההשעיה</label>
            <select id={daysId} value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-xl border border-border bg-background px-2 text-sm">
              {SUSPENSION_DAYS.map((d) => <option key={d} value={d}>{d === 365 ? "שנה" : `${d} ימים`}</option>)}
            </select>
            <ReasonAction
              label="השעיה"
              variant="destructive"
              onSubmit={async (reason) => {
                await api.setUserSuspension(account.id, days, reason);
                toast.success("החשבון הושעה");
                onChanged();
              }}
            />
          </div>
        )}
        {!protectedAccount && suspended && (
          <ReasonAction label="ביטול השעיה" onSubmit={async (reason) => { await api.setUserSuspension(account.id, null, reason); toast.success("ההשעיה בוטלה"); onChanged(); }} />
        )}
        <ReasonAction
          label={account.is_verified ? "הסרת אימות" : "סימון כמאומת"}
          onSubmit={async (reason) => { await api.setUserVerified(account.id, !account.is_verified, reason); toast.success("עודכן"); onChanged(); }}
        />
        {isAdmin && !isSelf && (
          <>
            <ReasonAction
              label={account.is_moderator ? "הסרת מודרטור" : "מינוי למודרטור"}
              onSubmit={async (reason) => { await api.setUserRoles(account.id, { is_moderator: !account.is_moderator }, reason); toast.success("התפקיד עודכן"); onChanged(); }}
            />
            <ReasonAction
              label={account.is_admin ? "הסרת מנהל מערכת" : "מינוי למנהל מערכת"}
              onSubmit={async (reason) => { await api.setUserRoles(account.id, { is_admin: !account.is_admin }, reason); toast.success("התפקיד עודכן"); onChanged(); }}
            />
          </>
        )}
        {isAdmin && !protectedAccount && (
          <ReasonAction
            label="מחיקת החשבון"
            variant="destructive"
            confirmText={account.username}
            confirmLabel={`מחיקה סופית של כל התוכן והקבצים. הקלידו ${account.username} לאישור`}
            onSubmit={async (reason) => { await api.adminDeleteUser(account.id, account.username, reason); toast.success("החשבון נמחק"); onChanged(); }}
          />
        )}
      </div>
    </AdminCard>
  );
}

export default function AdminAccounts({ isAdmin }: { isAdmin: boolean }) {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [submitted, setSubmitted] = useState(params.get("q") ?? "");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const searchId = useId();
  const accounts = useQuery({ queryKey: ["admin-accounts", submitted], queryFn: () => api.searchModerationUsers(submitted) });

  useEffect(() => {
    const fromUrl = params.get("q") ?? "";
    setQ(fromUrl);
    setSubmitted(fromUrl);
  }, [params]);

  return (
    <AdminSection title="חשבונות" description={isAdmin ? "חיפוש לפי שם, שם משתמש או אימייל. השעיה חוסמת פעולות; מחיקה סופית." : "חיפוש לפי שם או שם משתמש. מחיקה ותפקידים פתוחים למנהלי מערכת."}>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setParams(q.trim() ? { q: q.trim() } : {});
        }}
      >
        <label className="sr-only" htmlFor={searchId}>חיפוש חשבון</label>
        <input id={searchId} value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש חשבון" className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm" />
        <button type="submit" className="h-10 rounded-xl border border-border px-4 text-sm hover:bg-muted">חיפוש</button>
      </form>
      {accounts.isLoading ? (
        <AdminLoading />
      ) : !accounts.data?.length ? (
        <AdminEmpty>לא נמצאו חשבונות.</AdminEmpty>
      ) : (
        <div className="space-y-3">
          {accounts.data.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              isAdmin={isAdmin}
              selfId={user?.id}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin-accounts"] })}
            />
          ))}
        </div>
      )}
    </AdminSection>
  );
}
