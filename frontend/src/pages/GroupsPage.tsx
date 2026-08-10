import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";

export default function GroupsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const createGroup = useMutation({
    mutationFn: () => api.createGroup({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(t("groupCreated"));
      setShowCreate(false);
      setName("");
      setDescription("");
      navigate(`/groups/${group.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <ListPageSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("groups")}</h1>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <Link key={group.id} to={`/groups/${group.id}`}>
              <Card className="hover:shadow-glow transition-shadow h-full">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg mb-2">{group.name}</h3>
                  {group.description && (
                    <p className="text-muted-foreground text-sm mb-4">{group.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {group.members_count} {t("members")}
                  </div>
                </CardContent>
              </Card>
            </Link>
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
