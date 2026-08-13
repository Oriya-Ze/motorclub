import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SettingsSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { applyTheme, type Theme } from "@/lib/theme";
import { cn, displayName } from "@/lib/utils";

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
    <label className="flex items-center justify-between gap-4 py-2 cursor-pointer">
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

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? "");
      setUsername(user.username ?? "");
    }
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
    mutationFn: () => api.updateProfile({ full_name: fullName.trim(), username: username.trim() }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.success(t("profile.updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handlePhotoUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const result = await api.uploadMedia(file, "avatar");
      await api.updateProfile({ profile_picture_url: result.reference });
      await refreshUser();
      toast.success(t("profile.updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setUploadingPhoto(false);
    }
  };

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

  if (isLoading && !settings) {
    return <SettingsSkeleton />;
  }

  if (!settings) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsTitle")}</h1>
        <p className="text-muted-foreground">{t("settingsSubtitle")}</p>
      </div>

      {user && (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">{t("profile.editProfile")}</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold overflow-hidden shrink-0">
              {user.profile_picture_url ? (
                <img src={mediaUrl(user.profile_picture_url)} alt="" className="w-full h-full object-cover" />
              ) : (
                displayName(user)[0]?.toUpperCase()
              )}
            </div>
            <label className="cursor-pointer">
              <span className="text-sm text-primary hover:underline">{t("profile.changePhoto")}</span>
              <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={(e) => handlePhotoUpload(e.target.files)} />
            </label>
          </div>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("fullName")} />
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("username")} dir="ltr" />
          <Button
            size="sm"
            disabled={!fullName.trim() || !username.trim() || updateProfile.isPending}
            onClick={() => updateProfile.mutate()}
          >
            {t("profile.saveChanges")}
          </Button>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-1">
          <h3 className="font-semibold mb-3">{t("notifications.title")}</h3>
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
        <CardContent className="pt-6 space-y-1">
          <h3 className="font-semibold mb-3">{t("privacy")}</h3>
          <Toggle
            label={t("profilePublic")}
            checked={settings.profile_public}
            onChange={(v) => handleToggle("profile_public", v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <h3 className="font-semibold">{t("appearance")}</h3>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((theme) => (
              <Button
                key={theme}
                size="sm"
                variant={settings.theme === theme ? "default" : "outline"}
                onClick={() => handleTheme(theme)}
              >
                {t(theme)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <h3 className="font-semibold">{t("language")}</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={settings.language === "he" ? "default" : "outline"}
              onClick={() => handleLanguage("he")}
            >
              {t("hebrew")}
            </Button>
            <Button
              size="sm"
              variant={settings.language === "en" ? "default" : "outline"}
              onClick={() => handleLanguage("en")}
            >
              {t("english")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-semibold">{t("account")}</h3>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
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
            <Input name="current" type="password" placeholder={t("currentPassword")} dir="ltr" />
            <Input name="newPass" type="password" placeholder={t("newPassword")} dir="ltr" />
            <Button type="submit" variant="outline" size="sm" disabled={changePassword.isPending}>
              {t("changePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {user?.account_type !== "business" && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">{t("businessUpgrade")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("businessUpgradeDesc")}</p>
            <Button size="sm" onClick={() => businessUpgrade.mutate()} disabled={businessUpgrade.isPending}>
              {t("requestBusinessUpgrade")}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pb-8">
        <Link to="/privacy-policy" className="hover:text-primary hover:underline">{t("privacyPolicy")}</Link>
        <Link to="/terms-of-service" className="hover:text-primary hover:underline">{t("termsOfService")}</Link>
      </div>
    </div>
  );
}
