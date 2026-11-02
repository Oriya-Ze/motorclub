import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, MailCheck } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { digitsOnly } from "@/lib/numericInput";

const CODE_DIGITS = 6;
const RESEND_SECONDS = 60;
/** What the server answers for each way a code can fail, and which message explains it. */
const CODE_ERRORS: Record<string, string> = {
  deletion_code_invalid: "accountDeletion.errors.invalid",
  deletion_code_expired: "accountDeletion.errors.expired",
  deletion_code_missing: "accountDeletion.errors.expired",
  deletion_code_locked: "accountDeletion.errors.locked",
  deletion_code_not_sent: "accountDeletion.errors.notSent",
  account_deletion_failed: "accountDeletion.failed",
};
const WHAT_GOES = ["profile", "posts", "vehicles", "products", "messages", "groups", "files"] as const;
/** A code sent from this tab in the last minute: a refresh shows it again instead of emailing another one. */
const SENT_KEY = "motorclub_deletion_code_sent";

type SentCode = { email: string; minutes: number; at: number; userId: string };

function recentlySent(userId: string): SentCode | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SENT_KEY) || "null") as SentCode | null;
    return value && value.userId === userId && Date.now() - value.at < RESEND_SECONDS * 1000 ? value : null;
  } catch {
    return null;
  }
}

function rememberSent(value: SentCode) {
  try {
    sessionStorage.setItem(SENT_KEY, JSON.stringify(value));
  } catch {
    // The page still works; a refresh just sends a new code.
  }
}

function errorKey(err: unknown): string {
  if (err instanceof ApiError) {
    if (CODE_ERRORS[err.detail]) return CODE_ERRORS[err.detail];
    if (/too many requests/i.test(err.detail)) return "accountDeletion.errors.tooManyCodes";
  }
  return "accountDeletion.failed";
}

/**
 * Deleting an account takes a code emailed to its address, so a session left open on someone else's device is not
 * enough. A signed-in member lands straight on the code, which is sent as the page opens; a signed-out one comes
 * here after signing in (ProtectedRoute and ?next). The account goes only with the code and the final button.
 */
export default function DeleteAccountPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const id = useId();
  const earlier = user ? recentlySent(user.id) : null;
  const [sentTo, setSentTo] = useState<{ email: string; minutes: number } | null>(earlier);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(earlier ? Math.ceil((earlier.at + RESEND_SECONDS * 1000 - Date.now()) / 1000) : 0);
  const autoSent = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = useMutation({
    mutationFn: () => api.requestAccountDeletionCode(),
    onSuccess: (res) => {
      setSentTo({ email: res.email, minutes: res.expires_minutes });
      if (user) rememberSent({ email: res.email, minutes: res.expires_minutes, at: Date.now(), userId: user.id });
      setCode("");
      setError(null);
      setCooldown(RESEND_SECONDS);
    },
    onError: (err) => setError(errorKey(err)),
  });

  // Opening the page is the request: the code goes out at once (once, even under StrictMode's double effects).
  useEffect(() => {
    if (autoSent.current || sentTo) return;
    autoSent.current = true;
    sendCode.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useMutation({
    mutationFn: () => api.deleteAccount(code),
    onSuccess: () => {
      logout();
      toast.success(t("accountDeletion.done"));
      // A full load: nothing from the deleted session stays in memory.
      window.setTimeout(() => window.location.replace("/"), 600);
    },
    onError: (err) => {
      setError(errorKey(err));
      if (err instanceof ApiError && (err.detail === "deletion_code_locked" || err.detail === "deletion_code_expired")) setCode("");
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== CODE_DIGITS || remove.isPending) return;
    setError(null);
    remove.mutate();
  };

  const errorId = `${id}-error`;
  return (
    <div className="mx-auto max-w-xl space-y-4 pb-20 md:pb-6">
      <Link to="/settings?tab=account" className="inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 ltr:rotate-180" aria-hidden />
        {t("accountDeletion.back")}
      </Link>
      <PageHeading subtitle={t("accountDeletion.pageSubtitle")}>{t("accountDeletion.title")}</PageHeading>

      <Card className="border-destructive/40">
        <CardContent className="space-y-4 pt-5 pb-5">
          <div className="flex gap-3 rounded-xl bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <p>{t("accountDeletion.permanent")}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">{t("accountDeletion.whatGoes")}</h2>
            <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
              {WHAT_GOES.map((item) => (
                <li key={item}>{t(`accountDeletion.items.${item}`)}</li>
              ))}
            </ul>
          </div>

          {!sentTo ? (
            <div className="space-y-3 border-t border-border/60 pt-4">
              {error ? (
                <>
                  <p role="alert" className="text-sm text-destructive">{t(error)}</p>
                  <Button variant="destructive" disabled={sendCode.isPending} onClick={() => sendCode.mutate()}>
                    <MailCheck className="me-2 h-4 w-4" aria-hidden />
                    {sendCode.isPending ? t("accountDeletion.sending") : t("accountDeletion.sendCode")}
                  </Button>
                </>
              ) : (
                <p role="status" className="text-sm text-muted-foreground">{t("accountDeletion.sendingCode")}</p>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3 border-t border-border/60 pt-4" noValidate>
              <p className="text-sm" role="status">
                {t("accountDeletion.codeSent", { email: sentTo.email, minutes: sentTo.minutes })}
              </p>
              <div className="space-y-1">
                <label htmlFor={`${id}-code`} className="text-sm font-medium">{t("accountDeletion.codeLabel")}</label>
                <Input
                  id={`${id}-code`}
                  value={code}
                  onChange={(e) => {
                    setCode(digitsOnly(e.target.value, CODE_DIGITS));
                    setError(null);
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  dir="ltr"
                  className="max-w-48 text-center text-lg tracking-[0.4em]"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                  autoFocus
                />
                {error && <p id={errorId} role="alert" className="text-sm text-destructive">{t(error)}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="destructive" disabled={code.length !== CODE_DIGITS || remove.isPending}>
                  {remove.isPending ? t("accountDeletion.deleting") : t("accountDeletion.submit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={cooldown > 0 || sendCode.isPending || remove.isPending}
                  onClick={() => sendCode.mutate()}
                >
                  {cooldown > 0 ? t("accountDeletion.resendIn", { seconds: cooldown }) : t("accountDeletion.resend")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
