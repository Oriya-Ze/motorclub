import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import LogoLoader from "@/components/LogoLoader";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { takeAuthNext } from "@/lib/authNext";
import { clearPendingGoogleSignup, readPendingGoogleSignup } from "@/lib/googleSignup";

/**
 * After joining with Google: choose the username the community sees and accept the terms. Until this is done the
 * rest of the app sends the member here.
 */
export default function AccountSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading, setSignedInUser, completeGoogleSignup, loginWithGoogle } = useAuth();
  const id = useId();
  // New with Google: nothing is saved yet. (An account from before this flow may still be marked pending.)
  const [pending] = useState(() => (user ? null : readPendingGoogleSignup()));
  const [username, setUsername] = useState(() => user?.username ?? pending?.suggested_username ?? "");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) return <LogoLoader fullScreen />;
  if (!user && !pending) return <Navigate to="/auth" replace />;
  if (user && !user.account_setup_pending) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!agree) {
      setError(t("agreeTermsRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (user) {
        const updated = await api.accountSetup({ username: username.trim(), accept_terms: true });
        setSignedInUser({ ...user, ...updated, account_setup_pending: false });
      } else {
        await completeGoogleSignup(username.trim());
      }
      navigate(takeAuthNext() ?? "/", { replace: true });
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "";
      if (detail === "google_signup_expired" || detail === "account_setup_done") {
        clearPendingGoogleSignup();
        setExpired(true);
      }
      setError(detail === "google_signup_expired" ? t("accountSetup.expired") : err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardContent className="space-y-5 pt-8 pb-8">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-display tracking-wide">{t("accountSetup.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("accountSetup.subtitle")}</p>
          </div>
          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-1">
              <label htmlFor={`${id}-username`} className="text-sm font-medium">{t("username")}</label>
              <Input
                id={`${id}-username`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                dir="ltr"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={30}
                aria-describedby={`${id}-hint`}
                aria-invalid={Boolean(error) && agree}
              />
              <p id={`${id}-hint`} className="text-xs text-muted-foreground">{t("authValidation.usernameHint")}</p>
            </div>
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 rounded" />
              <span>
                {t("agreeTerms")}{" "}
                <Link to="/privacy-policy" state={{ returnTo: "/auth/welcome" }} className="text-primary hover:underline">
                  {t("privacyPolicy")}
                </Link>
                {" "}{t("and")}{" "}
                <Link to="/terms-of-service" state={{ returnTo: "/auth/welcome" }} className="text-primary hover:underline">
                  {t("termsOfService")}
                </Link>
              </span>
            </label>
            {error ? (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            ) : null}
            {expired ? (
              <Button type="button" variant="outline" className="w-full" onClick={() => void loginWithGoogle()}>
                {t("accountSetup.restart")}
              </Button>
            ) : null}
            <Button type="submit" className="w-full" disabled={saving || username.trim().length < 3}>
              {saving ? t("accountSetup.saving") : t("accountSetup.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
