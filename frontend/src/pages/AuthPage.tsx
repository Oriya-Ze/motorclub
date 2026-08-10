import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, type OAuthConfig } from "@/lib/api";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register" | "confirm";
type AuthMethod = "email" | "phone";

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, register, confirmSignUp, loginWithGoogle, startPhoneAuth, verifyPhoneAuth } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");
  const [phoneStep, setPhoneStep] = useState<"input" | "code">("input");
  const [phoneSession, setPhoneSession] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [oauthConfig, setOauthConfig] = useState<OAuthConfig | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    username: "",
    phone: "",
    code: "",
    agree: false,
  });

  useEffect(() => {
    api.getOAuthConfig()
      .then(setOauthConfig)
      .catch(() => setOauthConfig({ google_enabled: false }));
  }, []);

  const handleGoogleSignIn = async () => {
    if (mode === "register" && !form.agree) {
      toast.error(t("agreeTermsRequired"));
      return;
    }

    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authMethod === "phone" && mode !== "confirm") {
        if (phoneStep === "input") {
          if (mode === "register" && !form.agree) {
            toast.error(t("agreeTermsRequired"));
            return;
          }
          const res = await startPhoneAuth({
            phone: form.phone,
            full_name: mode === "register" ? form.full_name : undefined,
            username: mode === "register" ? form.username : undefined,
          });
          if (res.needs_registration) {
            if (mode === "login") {
              setMode("register");
              toast.message(t("smsRegisterDesc"));
              return;
            }
            toast.error(t("error"));
            return;
          }
          setPhoneSession(res.session || "");
          setNormalizedPhone(res.phone || form.phone);
          setPhoneStep("code");
          toast.success(res.message || t("smsCodeSent"));
          return;
        }

        await verifyPhoneAuth({
          phone: normalizedPhone || form.phone,
          code: form.code,
          session: phoneSession,
          full_name: mode === "register" ? form.full_name : undefined,
          username: mode === "register" ? form.username : undefined,
        });
        toast.success(t("loginSuccess"));
        navigate("/", { replace: true });
        return;
      }

      if (mode === "login") {
        await login(form.email, form.password);
        toast.success(t("loginSuccess"));
        navigate("/", { replace: true });
        return;
      }

      if (mode === "confirm") {
        await confirmSignUp({
          email: form.email,
          code: form.code,
          password: form.password,
        });
        toast.success(t("confirmSuccess"));
        navigate("/", { replace: true });
        return;
      }

      if (!form.agree) {
        toast.error(t("error"));
        return;
      }

      const res = await register({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        username: form.username,
      });

      if (res.confirmation_required) {
        setMode("confirm");
        toast.success(res.message || t("confirmEmailSent"));
        return;
      }

      toast.success(t("registerSuccess"));
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setPhoneStep("input");
    setPhoneSession("");
    if (next !== "confirm") {
      setForm((current) => ({ ...current, code: "" }));
    }
  };

  const switchAuthMethod = (next: AuthMethod) => {
    setAuthMethod(next);
    setPhoneStep("input");
    setPhoneSession("");
    setForm((current) => ({ ...current, code: "" }));
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl overflow-hidden shadow-glow">
            <img src="/logo.png" alt={t("appName")} className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-primary">
              {mode === "confirm" ? t("confirmAccount") : t("welcome")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {mode === "confirm" ? t("confirmAccountDesc") : t("appSubtitle")}
            </p>
          </div>

          {mode !== "confirm" && (
            <>
              <div className="flex bg-muted/50 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
                    mode === "login" ? "gradient-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t("login")}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all",
                    mode === "register" ? "gradient-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t("register")}
                </button>
              </div>
              <div className="flex bg-muted/30 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => switchAuthMethod("email")}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                    authMethod === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {t("email")}
                </button>
                <button
                  type="button"
                  onClick={() => switchAuthMethod("phone")}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                    authMethod === "phone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {t("phone")}
                </button>
              </div>
            </>
          )}
        </CardHeader>

        <CardContent>
          {mode !== "confirm" && oauthConfig?.google_enabled && authMethod === "email" && (
            <div className="space-y-4 mb-4">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={loading || googleLoading}
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon />
                {googleLoading ? t("redirectingToGoogle") : t("continueWithGoogle")}
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{t("orContinueWithEmail")}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMethod === "phone" && mode !== "confirm" ? (
              <>
                {mode === "register" && phoneStep === "input" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("fullName")}</label>
                      <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("username")}</label>
                      <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required dir="ltr" />
                    </div>
                  </>
                )}
                {phoneStep === "input" ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("phone")}</label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder={t("phonePlaceholder")}
                      required
                      dir="ltr"
                      inputMode="tel"
                    />
                    <p className="text-xs text-muted-foreground">
                      {mode === "login" ? t("smsLoginDesc") : t("smsRegisterDesc")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("verificationCode")}</label>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      required
                      dir="ltr"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </div>
                )}
                {mode === "register" && phoneStep === "input" && (
                  <label className="flex items-start gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={form.agree}
                      onChange={(e) => setForm({ ...form, agree: e.target.checked })}
                      className="mt-1 rounded"
                    />
                    <span>
                      {t("agreeTerms")}{" "}
                      <Link to="/privacy-policy" className="text-primary hover:underline">{t("privacyPolicy")}</Link>
                      {" "}{t("and")}{" "}
                      <Link to="/terms-of-service" className="text-primary hover:underline">{t("termsOfService")}</Link>
                    </span>
                  </label>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? "..."
                    : phoneStep === "input"
                      ? t("sendSmsCode")
                      : mode === "login"
                        ? t("loginBtn")
                        : t("registerBtn")}
                </Button>
                {phoneStep === "code" && (
                  <button
                    type="button"
                    onClick={() => setPhoneStep("input")}
                    className="block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {t("backToLogin")}
                  </button>
                )}
              </>
            ) : (
              <>
            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("fullName")}</label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("username")}</label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                    dir="ltr"
                  />
                </div>
              </>
            )}

            {(mode === "login" || mode === "register" || mode === "confirm") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("email")}</label>
                <Input
                  type="email"
                  placeholder="yourEmail@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  dir="ltr"
                  readOnly={mode === "confirm"}
                />
              </div>
            )}

            {mode === "confirm" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("verificationCode")}</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
            )}

            {(mode === "login" || mode === "register" || mode === "confirm") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("password")}</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    dir="ltr"
                    className="pl-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "register" && (
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.agree}
                  onChange={(e) => setForm({ ...form, agree: e.target.checked })}
                  className="mt-1 rounded"
                />
                <span>
                  {t("agreeTerms")}{" "}
                  <Link to="/privacy-policy" className="text-primary hover:underline">{t("privacyPolicy")}</Link>
                  {" "}{t("and")}{" "}
                  <Link to="/terms-of-service" className="text-primary hover:underline">{t("termsOfService")}</Link>
                </span>
              </label>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? mode === "login"
                  ? t("loggingIn")
                  : mode === "confirm"
                    ? t("confirming")
                    : t("registering")
                : mode === "login"
                  ? t("loginBtn")
                  : mode === "confirm"
                    ? t("confirmBtn")
                    : t("registerBtn")}
            </Button>

            {mode === "login" && (
              <Link to="/auth/forgot-password" className="block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                {t("forgotPassword")}
              </Link>
            )}

            {mode === "confirm" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {t("backToLogin")}
              </button>
            )}
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
