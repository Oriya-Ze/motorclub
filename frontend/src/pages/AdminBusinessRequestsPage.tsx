import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import PageHeading from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ListPageSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api, type BusinessUpgradeRequestAdmin } from "@/lib/api";

export default function AdminBusinessRequestsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<BusinessUpgradeRequestAdmin | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-business-requests"],
    queryFn: () => api.listBusinessUpgradeRequests("pending"),
    enabled: Boolean(user?.is_admin),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveBusinessUpgrade(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-business-requests"] });
      toast.success(t("adminBusiness.approved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.rejectBusinessUpgrade(id, reason),
    onSuccess: () => {
      setRejecting(null);
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-business-requests"] });
      toast.success(t("adminBusiness.rejected"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!user?.is_admin) return <Navigate to="/settings" replace />;
  if (isLoading) return <ListPageSkeleton rows={3} />;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-20 md:pb-6">
      <PageHeading subtitle={t("adminBusiness.subtitle")}>{t("adminBusiness.title")}</PageHeading>

      {requests.length === 0 ? (
        <EmptyState icon={Building2} title={t("adminBusiness.empty")} description={t("adminBusiness.emptyDesc")} />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardContent className="pt-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-lg">{req.business_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {req.contact_full_name} · {req.applicant_email}
                    </p>
                    {req.business_type && (
                      <p className="text-xs text-primary mt-1">{t(`businessCategories.${req.business_type}`)}</p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {t("adminBusiness.pending")}
                  </span>
                </div>

                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">{t("businessUpgradeForm.businessPhone")}</dt>
                    <dd dir="ltr">{req.business_phone}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("businessUpgradeForm.businessAddress")}</dt>
                    <dd>{req.business_address}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("businessUpgradeForm.contactName")}</dt>
                    <dd>{req.contact_full_name}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t("businessUpgradeForm.contactPhone")}</dt>
                    <dd dir="ltr">{req.contact_phone}</dd>
                  </div>
                  {req.business_registration_id && (
                    <div>
                      <dt className="text-muted-foreground">{t("businessUpgradeForm.registrationId")}</dt>
                      <dd dir="ltr">{req.business_registration_id}</dd>
                    </div>
                  )}
                </dl>

                {req.business_description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{req.business_description}</p>
                )}
                {req.additional_notes && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{t("businessUpgradeForm.additionalNotes")}: </span>
                    {req.additional_notes}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(req.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <Check className="w-4 h-4" />
                    {t("adminBusiness.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRejecting(req)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <X className="w-4 h-4" />
                    {t("adminBusiness.reject")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Link to="/settings" className="inline-block text-sm text-muted-foreground hover:text-primary">
        ← {t("settings")}
      </Link>

      {rejecting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setRejecting(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4">
            <h3 className="font-semibold">{t("adminBusiness.rejectTitle")}</h3>
            <p className="text-sm text-muted-foreground">{rejecting.business_name}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none"
              placeholder={t("adminBusiness.rejectReasonPlaceholder")}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejecting(null)}>
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                disabled={rejectReason.trim().length < 3 || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejecting.id, reason: rejectReason.trim() })}
              >
                {t("adminBusiness.confirmReject")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
