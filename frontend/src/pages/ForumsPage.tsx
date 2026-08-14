import { useQuery } from "@tanstack/react-query";
import { HelpCircle, Lightbulb, MessageSquare, ShoppingCart, Star, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import PageHeading from "@/components/PageHeading";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { api } from "@/lib/api";

const iconMap: Record<string, React.ElementType> = {
  HelpCircle, MessageSquare, ShoppingCart, Lightbulb, Star, Wrench,
};

export default function ForumsPage() {
  const { t } = useTranslation();
  const { data: forums = [], isLoading } = useQuery({
    queryKey: ["forums"],
    queryFn: () => api.getForums(),
  });

  if (isLoading) return <ListPageSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <PageHeading subtitle={t("forumsSubtitle")}>{t("forums")}</PageHeading>
      <div className="grid gap-4 sm:grid-cols-2">
        {forums.map((forum) => {
          const Icon = iconMap[forum.icon || "MessageSquare"] || MessageSquare;
          return (
            <Link key={forum.id} to={`/forums/${forum.id}`}>
              <Card className="hover:shadow-glow transition-shadow cursor-pointer h-full">
              <CardContent className="pt-6 flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{forum.name}</h3>
                  {forum.description && (
                    <p className="text-sm text-muted-foreground mt-1">{forum.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {forum.topics_count} {t("topics")}
                  </p>
                </div>
              </CardContent>
            </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
