import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Building2, Camera, Eye, Globe, KeyRound, Lock, Moon, Palette, Sun, UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SettingsSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { api } from "@/lib/api";
import { applyTheme, type Theme } from "@/lib/theme";
import { cn, displayName, formatHandle } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 cursor-pointer">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors shrink-0",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
            checked ? "start-5" : "start-0.5"
          )}
        />
      </button>
    </label>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Bell; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4 text-primary shrink-0" />
      <h3 className="font-semibold">{title}</h3>
    </div>
  );
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");

  const avatarUpload = useImageCropUpload({
    purpose: "avatar",
    onUploaded: async (result) => {
      try {
        await api.updateProfile({ profile_picture_url: result.reference });
        await refreshUser();
        queryClient.invalidateQueries({ queryKey: ["user"] });
        toast.success(t("profile.updated"));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("error"));
      }
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (user) setFullName(user.full_name ?? "");
  }, [user]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });

  const updateSettings = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.updateSettings(data),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      toast.success(t("settingsSaved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const changePassword = useMutation({
    mutationFn: ({ current, newPass }: { current: string; newPass: string }) =>
      api.changePassword(current, newPass),
    onSuccess: () => toast.success(t("passwordChanged")),
    onError: (err: Error) => toast.error(err.message),
  });

  const businessUpgrade = useMutation({
    mutationFn: () => api.requestBusinessUpgrade(),
    onSuccess: (data) => {
      if (data.status === "already_business") toast.info(t("alreadyBusiness"));
      else toast.success(t("businessUpgradePending"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProfile = useMutation({
    mutationFn: () => api.updateProfile({ full_name: fullName.trim() }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success(t("profile.updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleToggle = (key: string, value: boolean) => {
    updateSettings.mutate({ [key]: value });
  };

  const handleTheme = (theme: Theme) => {
    applyTheme(theme);
    updateSettings.mutate({ theme });
  };

  const handleLanguage = (language: string) => {
    i18n.changeLanguage(language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
    updateSettings.mutate({ language });
  };

  const nameChanged = user ? fullName.trim() !== (user.full_name ?? "").trim() : false;
  const accountTypeLabel =
    user?.account_type === "business" ? t("profile.businessAccount") : t("profile.personalAccount");

  if (isLoading && !settings) return <SettingsSkeleton />;
  if (!settings) return <SettingsSkeleton />;

  return (
    <>
      {avatarUpload.cropModal}
      <div className="max-w-2xl mx-auto space-y-5 pb-8">
        <div>
          <h1 className="text-2xl font-display tracking-wide">{t("settingsTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("settingsSubtitle")}</p>
        </div>

        {user && (
          <Card className="overflow-hidden">
            <div className="h-16 bg-gradient-to-l from-primary/20 via-primary/5 to-transparent" />
            <CardContent className="pt-0 pb-6">
              <div className="-mt-10 flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
                <div className="relative shrink-0 mx-auto sm:mx-0">
                  <Avatar user={user} size="2xl" className="border-4 border-card ring-2 ring-primary/20" />
                  <label className="absolute bottom-0 end-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:opacity-90 transition-opacity">
                    <Camera className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={avatarUpload.uploading}
                      onChange={(e) => avatarUpload.handleSelect(e.target.files)}
                    />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-start min-w-0 pb-1">
                  <p className="font-semibold text-lg truncate">{displayName(user)}</p>
                  <p className="text-sm text-muted-foreground truncate">{formatHandle(user)}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                  <span className="inline-flex items-center gap-1 mt-2 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                    <UserCircle className="w-3.5 h-3.5" />
                    {accountTypeLabel}
                  </span>
                </div>
                <Link to="/profile" className="shrink-0 mx-auto sm:mx-0 sm:mb-1">
                  <Button variant="outline" size="sm">{t("profile.nav")}</Button>
                </Link>
              </div>

              <div className="space-y-4 border-t border-border/50 pt-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("fullName")}</label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("fullName")}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    {t("username")}
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
                  </label>
                  <Input
                    value={formatHandle(user)}
                    readOnly
                    disabled
                    dir="ltr"
                    className="bg-muted/40 text-muted-foreground cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">{t("usernameLocked")}</p>
                </div>

                <Button
                  size="sm"
                  disabled={!nameChanged || !fullName.trim() || updateProfile.isPending}
                  onClick={() => updateProfile.mutate()}
                >
                  {t("profile.saveChanges")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-5 pb-4">
            <SectionHeader icon={Bell} title={t("notifications.title")} />
            <Toggle
              label={t("postNotifications")}
              checked={settings.post_notifications}
              onChange={(v) => handleToggle("post_notifications", v)}
            />
            <Toggle
              label={t("commentNotifications")}
              checked={settings.comment_notifications}
              onChange={(v) => handleToggle("comment_notifications", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <SectionHeader icon={Eye} title={t("privacy")} />
            <Toggle
              label={t("profilePublic")}
              checked={settings.profile_public}
              onChange={(v) => handleToggle("profile_public", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-3">
            <SectionHeader icon={Palette} title={t("appearance")} />
            <div className="grid grid-cols-2 gap-2">
              {(["dark", "light"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => handleTheme(theme)}
                  className={cn(
                    "flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-colors",
                    settings.theme === theme
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  {theme === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  {t(theme)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-3">
            <SectionHeader icon={Globe} title={t("language")} />
            <div className="grid grid-cols-2 gap-2">
              {(["he", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleLanguage(lang)}
                  className={cn(
                    "px-3 py-3 rounded-xl border text-sm font-medium transition-colors",
                    settings.language === lang
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  {lang === "he" ? t("hebrew") : t("english")}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">
            <SectionHeader icon={KeyRound} title={t("account")} />
            <p className="text-sm text-muted-foreground -mt-1">{user?.email}</p>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                changePassword.mutate({
                  current: fd.get("current") as string,
                  newPass: fd.get("newPass") as string,
                });
                e.currentTarget.reset();
              }}
            >
              <Input name="current" type="password" placeholder={t("currentPassword")} dir="ltr" autoComplete="current-password" />
              <Input name="newPass" type="password" placeholder={t("newPassword")} dir="ltr" autoComplete="new-password" />
              <Button type="submit" variant="outline" size="sm" disabled={changePassword.isPending}>
                {t("changePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {user?.account_type !== "business" && (
          <Card className="border-primary/20">
            <CardContent className="pt-5 pb-5">
              <SectionHeader icon={Building2} title={t("businessUpgrade")} />
              <p className="text-sm text-muted-foreground mb-4">{t("businessUpgradeDesc")}</p>
              <Button size="sm" onClick={() => businessUpgrade.mutate()} disabled={businessUpgrade.isPending}>
                {t("requestBusinessUpgrade")}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
          <Link to="/privacy-policy" className="hover:text-primary hover:underline">{t("privacyPolicy")}</Link>
          <Link to="/terms-of-service" className="hover:text-primary hover:underline">{t("termsOfService")}</Link>
        </div>
      </div>
    </>
  );
}
