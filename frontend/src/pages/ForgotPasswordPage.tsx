import { useMutation } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import LanguageToggle from "@/components/LanguageToggle";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgotPassword = useMutation({
    mutationFn: () => api.forgotPassword(email),
    onSuccess: () => {
      setSent(true);
      toast.success(t("resetEmailSent"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative">
      <div className="absolute top-4 end-4">
        <LanguageToggle />
      </div>
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl overflow-hidden shadow-glow">
            <img src="/logo.png" alt={t("appName")} className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("forgotPassword")}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{t("forgotPasswordDesc")}</p>
          </div>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{t("resetEmailSent")}</p>
              <Link to={`/auth/reset-password?email=${encodeURIComponent(email)}`}>
                <Button className="w-full">{t("enterResetCode")}</Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" className="w-full">
                  <ArrowRight className="w-4 h-4" />
                  {t("backToLogin")}
                </Button>
              </Link>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                forgotPassword.mutate();
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("email")}</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? "..." : t("sendResetLink")}
              </Button>
              <Link to="/auth" className="block text-center text-sm text-muted-foreground hover:text-primary">
                {t("backToLogin")}
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
