import { Car, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register" | "confirm";

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, register, confirmSignUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    username: "",
    code: "",
    agree: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
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
    if (next !== "confirm") {
      setForm((current) => ({ ...current, code: "" }));
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-glow">
            <Car className="w-8 h-8 text-white" />
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
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
