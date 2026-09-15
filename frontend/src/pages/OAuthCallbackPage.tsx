import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { oauthRedirectUri } from "@/lib/cognitoOAuth";

export default function OAuthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { completeOAuthLogin } = useAuth();
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
      .then(() => {
        toast.success(t("loginSuccess"));
        navigate("/", { replace: true });
      })
      .catch((err: Error) => {
        setError(err.message || t("error"));
      });
  }, [completeOAuthLogin, navigate, params, t]);

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
