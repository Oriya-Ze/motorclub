import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Clock, ExternalLink, ImagePlus, MapPin, Package, Pencil, Plus, Star, Trash2, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import CreateProductModal from "@/components/CreateProductModal";
import EditProductModal from "@/components/EditProductModal";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { useImageCropUpload } from "@/hooks/useImageCropUpload";
import { api, Product } from "@/lib/api";
import { ALL_BUSINESS_TYPES } from "@/lib/businessTypes";
import {
  BusinessHours,
  BusinessService,
  DAY_KEYS,
  defaultBusinessHours,
  getBusinessProfilePath,
  mapsEmbedUrl,
} from "@/lib/businessProfile";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export default function BusinessSettingsSection() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessRegistrationId, setBusinessRegistrationId] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHours>(defaultBusinessHours());
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [certifications, setCertifications] = useState("");
  const [serviceCities, setServiceCities] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceDesc, setNewServiceDesc] = useState("");

  useEffect(() => {
    if (!user) return;
    setBusinessName(user.full_name ?? "");
    setBusinessType(user.business_type ?? "garage");
    setBusinessPhone(user.business_phone ?? "");
    setBusinessAddress(user.business_address ?? "");
    setBusinessDescription(user.business_description ?? "");
    setBusinessWebsite(user.business_website ?? "");
    setBusinessRegistrationId(user.business_registration_id ?? "");
    setBusinessHours(user.business_hours ?? defaultBusinessHours());
    setGalleryUrls(user.gallery_urls ?? []);
    setCoverImageUrl(user.cover_image_url ?? "");
    setProfilePictureUrl(user.profile_picture_url ?? "");
    setCertifications((user.certifications ?? []).join(", "));
    setServiceCities((user.service_area?.cities ?? []).join(", "));
  }, [user]);

  const coverUpload = useImageCropUpload({
    purpose: "product",
    cropPurpose: "cover",
    onUploaded: (result) => setCoverImageUrl(result.reference),
    onError: (err) => toast.error(err.message),
  });

  const avatarUpload = useImageCropUpload({
    purpose: "avatar",
    onUploaded: (result) => setProfilePictureUrl(result.reference),
    onError: (err) => toast.error(err.message),
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["my-products"],
    queryFn: () => api.getMyProducts(),
    enabled: user?.account_type === "business",
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["my-business-services"],
    queryFn: () => api.getMyBusinessServices(),
    enabled: user?.account_type === "business",
  });

  const { data: analytics } = useQuery({
    queryKey: ["business-analytics"],
    queryFn: () => api.getBusinessAnalytics(),
    enabled: user?.account_type === "business",
  });

  const updateBusiness = useMutation({
    mutationFn: () =>
      api.updateProfile({
        full_name: businessName.trim(),
        business_type: businessType,
        business_phone: businessPhone.trim() || undefined,
        business_address: businessAddress.trim() || undefined,
        business_description: businessDescription.trim() || undefined,
        business_website: businessWebsite.trim() || undefined,
        business_registration_id: businessRegistrationId.trim() || undefined,
        business_hours: businessHours,
        gallery_urls: galleryUrls,
        cover_image_url: coverImageUrl || undefined,
        profile_picture_url: profilePictureUrl || undefined,
        certifications: certifications
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        service_area: serviceCities.trim()
          ? { cities: serviceCities.split(",").map((s) => s.trim()).filter(Boolean) }
          : undefined,
      }),
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["user"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast.success(t("businessSettings.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("businessSettings.productDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createService = useMutation({
    mutationFn: () =>
      api.createBusinessService({
        name: newServiceName.trim(),
        description: newServiceDesc.trim() || undefined,
        price_from: newServicePrice ? Number(newServicePrice) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-business-services"] });
      setNewServiceName("");
      setNewServicePrice("");
      setNewServiceDesc("");
      toast.success(t("businessSettings.serviceCreated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteService = useMutation({
    mutationFn: (id: string) => api.deleteBusinessService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-business-services"] });
      toast.success(t("businessSettings.serviceDeleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!user || user.account_type !== "business") return null;

  const categoryLabel = user.business_type
    ? t(`businessCategories.${user.business_type}`, { defaultValue: user.business_type })
    : null;

  const profilePath = getBusinessProfilePath(user.business_type, user.id);
  const previewSpecializations = [
    businessType ? t(`businessCategories.${businessType}`, { defaultValue: businessType }) : null,
    ...certifications.split(",").map((s) => s.trim()).filter(Boolean),
  ].filter(Boolean) as string[];
  const previewRating =
    analytics?.rating_avg != null && analytics.review_count > 0
      ? Number(analytics.rating_avg).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {coverUpload.cropModal}
      {avatarUpload.cropModal}

      {/* Live preview */}
      <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm">
        <div className="relative h-24 sm:h-28 bg-gradient-to-l from-primary/25 via-primary/10 to-muted/30">
          {coverImageUrl ? (
            <img src={mediaUrl(coverImageUrl)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
        </div>
        <div className="px-4 pb-4 pt-0">
          <div className="flex items-end gap-3 -mt-10">
            <Avatar
              user={{ id: user.id, full_name: businessName, profile_picture_url: profilePictureUrl }}
              size="xl"
              preview
              className="border-4 border-card ring-2 ring-primary/15 bg-card shrink-0"
            />
            <div className="flex-1 min-w-0 pb-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg truncate">{businessName || t("businessUpgradeForm.businessName")}</p>
                {user.is_verified && <VerifiedBadge className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {previewRating ?? "—"}
                </span>
                {categoryLabel && (
                  <span className="text-xs text-primary truncate">{categoryLabel}</span>
                )}
              </div>
            </div>
          </div>
          {businessDescription && (
            <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{businessDescription}</p>
          )}
          {previewSpecializations.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {previewSpecializations.slice(0, 4).map((item) => (
                <span key={item} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 pb-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
          <p className="text-xs text-muted-foreground">{t("businessSettings.publicProfileHint")}</p>
          <Link to={profilePath}>
            <Button variant="outline" size="sm" className="gap-2">
              <ExternalLink className="w-4 h-4" />
              {t("businessSettings.viewPublicProfile")}
            </Button>
          </Link>
        </div>
      </div>

      {analytics && (
        <div className="rounded-xl border border-border/50 p-4 space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {t("businessSettings.analyticsTitle", { days: analytics.period_days })}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Stat label={t("businessSettings.analyticsViews")} value={analytics.views} />
            <Stat label={t("businessSettings.analyticsCalls")} value={analytics.call_clicks} />
            <Stat label={t("businessSettings.analyticsNavigate")} value={analytics.navigate_clicks} />
            <Stat label={t("businessSettings.analyticsWhatsapp")} value={analytics.whatsapp_clicks} />
            <Stat label={t("businessSettings.analyticsShares")} value={analytics.share_clicks} />
            <Stat
              label={t("businessSettings.analyticsRating")}
              value={analytics.rating_avg != null ? `${analytics.rating_avg} (${analytics.review_count})` : "—"}
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="font-semibold">{t("businessSettings.appearanceSection")}</h4>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessSettings.coverImage")}</label>
          <div className="relative h-32 sm:h-36 rounded-xl overflow-hidden bg-muted/40 border border-border/50">
            {coverImageUrl ? (
              <img src={mediaUrl(coverImageUrl)} alt="" className="w-full h-full object-cover" />
            ) : null}
            <label className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20 hover:bg-black/30 transition-colors">
              <ImagePlus className="w-6 h-6 text-white" />
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => coverUpload.handleSelect(e.target.files)} />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessSettings.profileImage")}</label>
          <div className="flex items-center gap-4">
            <Avatar
              user={{ id: user.id, full_name: businessName, profile_picture_url: profilePictureUrl }}
              size="2xl"
              preview
              className="border-4 border-card ring-2 ring-primary/15"
            />
            <label className="cursor-pointer inline-flex h-9 items-center justify-center rounded-xl border border-border bg-transparent px-4 text-sm font-medium hover:bg-muted transition-colors">
              {t("profile.changePhoto")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => avatarUpload.handleSelect(e.target.files)} />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessUpgradeForm.businessName")}</label>
          <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessUpgradeForm.businessType")}</label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {ALL_BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`businessCategories.${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessUpgradeForm.businessPhone")}</label>
          <Input value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} dir="ltr" />
        </div>
      </div>

      <div className="space-y-4 border-t border-border/50 pt-6">
        <h4 className="font-semibold">{t("businessSettings.aboutSection")}</h4>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessUpgradeForm.businessDescription")}</label>
          <textarea
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessSettings.certifications")}</label>
          <Input value={certifications} onChange={(e) => setCertifications(e.target.value)} placeholder={t("businessSettings.certificationsPlaceholder")} />
          <p className="text-xs text-muted-foreground">{t("businessSettings.specializationsHint")}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessUpgradeForm.website")}</label>
          <Input value={businessWebsite} onChange={(e) => setBusinessWebsite(e.target.value)} dir="ltr" placeholder="https://" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessUpgradeForm.registrationId")}</label>
          <Input value={businessRegistrationId} onChange={(e) => setBusinessRegistrationId(e.target.value)} dir="ltr" />
        </div>
      </div>

      <div className="space-y-4 border-t border-border/50 pt-6">
        <h4 className="font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          {t("businessSettings.locationSection")}
        </h4>
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            {t("businessUpgradeForm.businessAddress")}
          </label>
          <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t("businessSettings.addressMapHint")}</p>
        </div>
        {businessAddress && (
          <div className="relative h-36 rounded-xl overflow-hidden border border-border/50">
            <iframe
              title={t("businessProfile.map")}
              src={mapsEmbedUrl(businessAddress)}
              className="absolute inset-0 w-full h-full border-0 pointer-events-none scale-[1.02]"
              loading="lazy"
            />
            <p className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs font-semibold text-white/90 pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
              {businessAddress}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-medium">{t("businessProfile.hours")}</label>
          <div className="space-y-2 rounded-xl border border-border/50 p-3">
            {DAY_KEYS.map((key) => {
              const day = businessHours[key] ?? { closed: false };
              return (
                <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-16 text-muted-foreground">{t(`businessProfile.days.${key}`)}</span>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={Boolean(day.closed)}
                      onChange={(e) =>
                        setBusinessHours((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], closed: e.target.checked },
                        }))
                      }
                    />
                    {t("businessProfile.closed")}
                  </label>
                  {!day.closed && (
                    <>
                      <Input
                        type="time"
                        className="w-28"
                        value={day.open ?? "08:00"}
                        onChange={(e) =>
                          setBusinessHours((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], open: e.target.value, closed: false },
                          }))
                        }
                      />
                      <span>–</span>
                      <Input
                        type="time"
                        className="w-28"
                        value={day.close ?? "17:00"}
                        onChange={(e) =>
                          setBusinessHours((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], close: e.target.value, closed: false },
                          }))
                        }
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Button size="sm" disabled={!businessName.trim() || updateBusiness.isPending} onClick={() => updateBusiness.mutate()}>
          {t("profile.saveChanges")}
        </Button>
      </div>

      <div className="space-y-4 border-t border-border/50 pt-6">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          <h4 className="font-semibold">{t("businessSettings.servicesSection")}</h4>
        </div>
        <div className="space-y-2 rounded-xl border border-border/50 p-3">
          <Input value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder={t("businessSettings.serviceName")} />
          <Input value={newServicePrice} onChange={(e) => setNewServicePrice(e.target.value)} placeholder={t("businessSettings.servicePriceFrom")} dir="ltr" type="number" />
          <textarea
            value={newServiceDesc}
            onChange={(e) => setNewServiceDesc(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
            placeholder={t("businessSettings.serviceDescription")}
          />
          <Button size="sm" disabled={!newServiceName.trim() || createService.isPending} onClick={() => createService.mutate()}>
            <Plus className="w-4 h-4" />
            {t("businessSettings.addService")}
          </Button>
        </div>
        {servicesLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("businessSettings.noServices")}</p>
        ) : (
          <ServiceList services={services} onDelete={(id) => deleteService.mutate(id)} deleting={deleteService.isPending} />
        )}
      </div>

      <div className="space-y-4 border-t border-border/50 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h4 className="font-semibold">{t("businessSettings.productsSection")}</h4>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            {t("businessSettings.addProduct")}
          </Button>
        </div>

        {productsLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl bg-muted/30 p-4">{t("businessSettings.noProducts")}</p>
        ) : (
          <div className="space-y-2">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
                {product.image_urls?.[0] ? (
                  <img src={mediaUrl(product.image_urls[0])} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-primary text-sm">₪{product.price.toLocaleString()}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditProduct(product)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  disabled={deleteProduct.isPending}
                  onClick={() => {
                    if (window.confirm(t("businessSettings.confirmDelete"))) deleteProduct.mutate(product.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateProductModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ["my-products"] });
          void queryClient.invalidateQueries({ queryKey: ["products"] });
        }}
      />
      {editProduct && (
        <EditProductModal
          product={editProduct}
          open={Boolean(editProduct)}
          onClose={() => setEditProduct(null)}
          onUpdated={() => {
            void queryClient.invalidateQueries({ queryKey: ["my-products"] });
            void queryClient.invalidateQueries({ queryKey: ["products"] });
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ServiceList({
  services,
  onDelete,
  deleting,
}: {
  services: BusinessService[];
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {services.map((service) => (
        <div key={service.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
          <Wrench className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{service.name}</p>
            {service.price_from != null && <p className="text-xs text-primary">₪{service.price_from.toLocaleString()}+</p>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={deleting}
            onClick={() => {
              if (window.confirm(t("businessSettings.confirmDeleteService"))) onDelete(service.id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
