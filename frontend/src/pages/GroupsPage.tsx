import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import PageHeading from "@/components/PageHeading";
import GroupCard from "@/components/GroupCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function GroupsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(Boolean((location.state as { openCreate?: boolean } | null)?.openCreate));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "closed">("public");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const createGroup = useMutation({
    mutationFn: () => api.createGroup({
      name: name.trim(),
      description: description.trim() || undefined,
      privacy,
    }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(t("groupCreated"));
      setShowCreate(false);
      setName("");
      setDescription("");
      setPrivacy("public");
      navigate(`/groups/${group.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <ListPageSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeading className="mb-0" subtitle={t("groupsSubtitle")}>{t("groups")}</PageHeading>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          {t("createGroup")}
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <Users className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">{t("noGroups")}</p>
          <Button onClick={() => setShowCreate(true)}>{t("createGroup")}</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("createGroup")}</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("groupNamePlaceholder")}
              className="h-11"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("groupDescriptionPlaceholder")}
              rows={3}
              className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="grid grid-cols-2 gap-2">
              {(["public", "closed"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPrivacy(value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-start transition-colors",
                    privacy === value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/20 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <p className="text-sm font-medium">
                    {value === "public" ? t("groupPrivacyPublic") : t("groupPrivacyPrivate")}
                  </p>
                  <p className="text-xs mt-0.5">
                    {value === "public" ? t("groupPrivacyPublicHint") : t("groupPrivacyPrivateHint")}
                  </p>
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={name.trim().length < 2 || createGroup.isPending}
              onClick={() => createGroup.mutate()}
            >
              {t("createGroup")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
