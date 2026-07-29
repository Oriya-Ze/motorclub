import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";

export default function GroupsPage() {
  const { t } = useTranslation();
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">...</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("groups")}</h1>
      {groups.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">{t("noGroups")}</p>
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
    </div>
  );
}
