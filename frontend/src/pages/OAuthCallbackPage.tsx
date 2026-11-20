import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/api";
import { oauthRedirectUri } from "@/lib/cognitoOAuth";
import { takeAuthNext } from "@/lib/authNext";

const LINK_RETRY_KEY = "motorclub_oauth_link_retry";

export default function OAuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { completeOAuthLogin, loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) {
      setError(oauthError);
      return;
    }

    const code = params.get("code");
    if (!code) {
      setError(t("oauthMissingCode"));
      return;
    }

    completeOAuthLogin({ code, redirect_uri: oauthRedirectUri() })
      .then(({ user: signedIn, signupPending }) => {
        try {
          sessionStorage.removeItem(LINK_RETRY_KEY);
        } catch {
          // storage blocked: nothing to clear
        }
        if (signupPending || signedIn?.account_setup_pending) {
          // A new member chooses a username and accepts the terms first; the saved destination waits for that.
          navigate("/auth/welcome", { replace: true });
          return;
        }
        toast.success(t("loginSuccess"));
        navigate(takeAuthNext() ?? "/", { replace: true });
      })
      .catch((err: Error) => {
        // Google was just linked to an existing password account: one more pass through Google signs in to it.
        if (err instanceof ApiError && err.detail === "oauth_account_linked") {
          let retried = false;
          try {
            retried = sessionStorage.getItem(LINK_RETRY_KEY) === "1";
            sessionStorage.setItem(LINK_RETRY_KEY, "1");
          } catch {
            retried = true;
          }
          if (!retried) {
            void loginWithGoogle().catch(() => setError(t("oauthLinkFailed")));
            return;
          }
          setError(t("oauthLinkFailed"));
          return;
        }
        setError(err.message || t("error"));
      });
  }, [completeOAuthLogin, loginWithGoogle, navigate, params, t]);

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {!error ? (
            <>
              <p className="text-lg font-medium">{t("oauthCompleting")}</p>
              <p className="text-sm text-muted-foreground">{t("loggingIn")}</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-destructive">{t("error")}</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Link to="/auth" className="inline-flex w-full items-center justify-center rounded-xl h-11 px-6 gradient-primary text-primary-foreground shadow-glow hover:opacity-90 font-medium">
                {t("backToLogin")}
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
