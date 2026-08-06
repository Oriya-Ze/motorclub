import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Car } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const resetPassword = useMutation({
    mutationFn: () => api.resetPassword({ email, code, new_password: password }),
    onSuccess: () => {
      toast.success(t("resetPasswordSuccess"));
      navigate("/auth", { replace: true });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-glow">
            <Car className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("resetPassword")}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{t("resetPasswordDesc")}</p>
          </div>
        </CardHeader>

        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              resetPassword.mutate();
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
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("verificationCode")}</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("newPassword")}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "..." : t("resetPasswordBtn")}
            </Button>
            <Link to="/auth" className="block text-center text-sm text-muted-foreground hover:text-primary">
              {t("backToLogin")}
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
