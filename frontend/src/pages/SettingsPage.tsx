import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Building2, Camera, Eye, Globe, KeyRound, Lock, Moon, Palette, Shield, Sun, UserCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import BusinessSettingsSection from "@/components/BusinessSettingsSection";
import BusinessUpgradeModal from "@/components/BusinessUpgradeModal";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SettingsSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { applyAppLanguage, type AppLanguage } from "@/i18n";
import { api } from "@/lib/api";
import type { BusinessUpgradeFormData } from "@/lib/businessTypes";
import { applyTheme, type Theme } from "@/lib/theme";
import { cn, displayName, formatHandle } from "@/lib/utils";

type SettingsTab = "profile" | "preferences" | "business" | "account" | "admin";

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <span className="text-sm font-medium block">{label}</span>
        {description && <span className="text-xs text-muted-foreground mt-0.5 block">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5",
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

const TAB_ICONS = {
  profile: UserCircle,
  preferences: Palette,
  business: Building2,
  account: KeyRound,
  admin: Shield,
} as const;

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

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

  const { data: upgradeRequest, refetch: refetchUpgrade } = useQuery({
    queryKey: ["business-upgrade"],
    queryFn: () => api.getMyBusinessUpgrade(),
    enabled: user?.account_type !== "business",
  });

  useEffect(() => {
    if (upgradeRequest?.status === "approved" && user?.account_type !== "business") {
      void refreshUser();
    }
  }, [upgradeRequest?.status, user?.account_type, refreshUser]);

  const businessUpgrade = useMutation({
    mutationFn: (data: BusinessUpgradeFormData) => api.requestBusinessUpgrade(data),
    onSuccess: async () => {
      setShowUpgradeForm(false);
      await refetchUpgrade();
      toast.success(t("businessUpgradePending"));
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

  const tabs = useMemo(() => {
    const list: SettingsTab[] = ["profile", "preferences", "account"];
    if (user?.account_type === "business") list.splice(2, 0, "business");
    if (user?.is_admin) list.push("admin");
    return list;
  }, [user?.account_type, user?.is_admin]);

  useEffect(() => {
    if (!tabs.includes(activeTab)) setActiveTab("profile");
  }, [tabs, activeTab]);

  const handleToggle = (key: string, value: boolean) => {
    updateSettings.mutate({ [key]: value });
  };

  const handleTheme = (theme: Theme) => {
    applyTheme(theme);
    updateSettings.mutate({ theme });
  };

  const handleLanguage = (language: AppLanguage) => {
    applyAppLanguage(language);
    void i18n.changeLanguage(language);
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
      <div className="max-w-4xl mx-auto pb-10">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-display tracking-wide">{t("settingsTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("settingsSubtitle")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                    activeTab === tab
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {t(`settingsTabs.${tab}`)}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 space-y-5">
            {activeTab === "profile" && user && (
              <>
                <Card className="overflow-hidden">
                  <div className="h-24 bg-gradient-to-l from-primary/30 via-primary/10 to-transparent" />
                  <CardContent className="pt-0 pb-6">
                    <div className="-mt-12 flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
                      <div className="relative shrink-0 mx-auto sm:mx-0">
                        <Avatar user={user} size="2xl" className="border-4 border-card ring-2 ring-primary/25" />
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
                        <p className="font-semibold text-xl truncate">{displayName(user)}</p>
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
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-1.5">
                          {t("username")}
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
                        </label>
                        <Input value={formatHandle(user)} readOnly disabled dir="ltr" className="bg-muted/40 text-muted-foreground cursor-not-allowed" />
                        <p className="text-xs text-muted-foreground">{t("usernameLocked")}</p>
                      </div>
                      <Button size="sm" disabled={!nameChanged || !fullName.trim() || updateProfile.isPending} onClick={() => updateProfile.mutate()}>
                        {t("profile.saveChanges")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {user.account_type !== "business" && (
                  <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardContent className="pt-5 pb-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold">{t("businessUpgrade")}</h3>
                          <p className="text-sm text-muted-foreground mt-1 mb-4">{t("businessUpgradeDesc")}</p>
                          {upgradeRequest?.status === "pending" ? (
                            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm">
                              <p className="font-medium text-amber-700 dark:text-amber-400">{t("businessUpgradePending")}</p>
                              {upgradeRequest.business_name && (
                                <p className="text-muted-foreground mt-1">{upgradeRequest.business_name}</p>
                              )}
                            </div>
                          ) : upgradeRequest?.status === "rejected" ? (
                            <div className="space-y-3">
                              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm">
                                <p className="font-medium text-destructive">{t("businessUpgradeRejected")}</p>
                                {upgradeRequest.rejection_reason && (
                                  <p className="text-muted-foreground mt-1">{upgradeRequest.rejection_reason}</p>
                                )}
                              </div>
                              <Button size="sm" onClick={() => setShowUpgradeForm(true)}>{t("businessUpgradeResubmit")}</Button>
                            </div>
                          ) : (
                            <Button size="sm" onClick={() => setShowUpgradeForm(true)}>{t("requestBusinessUpgrade")}</Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {activeTab === "preferences" && (
              <>
                <Card>
                  <CardContent className="pt-5 pb-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Bell className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">{t("notifications.title")}</h3>
                    </div>
                    <Toggle label={t("postNotifications")} checked={settings.post_notifications} onChange={(v) => handleToggle("post_notifications", v)} />
                    <Toggle label={t("commentNotifications")} checked={settings.comment_notifications} onChange={(v) => handleToggle("comment_notifications", v)} />
                    <Toggle label={t("eventNotifications")} checked={settings.event_notifications} onChange={(v) => handleToggle("event_notifications", v)} description={t("settingsEventNotificationsDesc")} />
                    <Toggle label={t("emailNotifications")} checked={settings.email_notifications} onChange={(v) => handleToggle("email_notifications", v)} description={t("settingsEmailNotificationsDesc")} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5 pb-2">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">{t("privacy")}</h3>
                    </div>
                    <Toggle label={t("profilePublic")} checked={settings.profile_public} onChange={(v) => handleToggle("profile_public", v)} description={t("settingsProfilePublicDesc")} />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5 pb-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">{t("appearance")}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["dark", "light"] as const).map((theme) => (
                        <button
                          key={theme}
                          type="button"
                          onClick={() => handleTheme(theme)}
                          className={cn(
                            "flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-colors",
                            settings.theme === theme ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50 text-muted-foreground"
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
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold">{t("language")}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(["he", "en"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => handleLanguage(lang)}
                          className={cn(
                            "px-3 py-3 rounded-xl border text-sm font-medium transition-colors",
                            settings.language === lang ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          {lang === "he" ? t("hebrew") : t("english")}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "business" && user?.account_type === "business" && (
              <Card>
                <CardContent className="pt-5 pb-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Building2 className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-lg">{t("settingsTabs.business")}</h3>
                  </div>
                  <BusinessSettingsSection />
                </CardContent>
              </Card>
            )}

            {activeTab === "account" && (
              <Card>
                <CardContent className="pt-5 pb-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">{t("account")}</h3>
                  </div>
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
                    <Input name="current" type="password" placeholder={t("currentPassword")} dir="ltr" autoComplete="current-password" />
                    <Input name="newPass" type="password" placeholder={t("newPassword")} dir="ltr" autoComplete="new-password" />
                    <Button type="submit" variant="outline" size="sm" disabled={changePassword.isPending}>
                      {t("changePassword")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeTab === "admin" && user?.is_admin && (
              <Card>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">{t("adminBusiness.nav")}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{t("adminBusiness.subtitle")}</p>
                  <Link to="/admin/business-requests">
                    <Button variant="outline" size="sm">{t("adminBusiness.title")}</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-2">
              <Link to="/privacy-policy" className="hover:text-primary hover:underline">{t("privacyPolicy")}</Link>
              <Link to="/terms-of-service" className="hover:text-primary hover:underline">{t("termsOfService")}</Link>
            </div>
          </div>
        </div>
      </div>

      <BusinessUpgradeModal
        open={showUpgradeForm}
        onClose={() => setShowUpgradeForm(false)}
        onSubmit={(data) => businessUpgrade.mutate(data)}
        isSubmitting={businessUpgrade.isPending}
        defaultContactName={user?.full_name ?? ""}
      />
    </>
  );
}
