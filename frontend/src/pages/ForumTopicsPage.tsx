import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/Card";
import { api } from "@/lib/api";

export default function ForumTopicsPage() {
  const { t, i18n } = useTranslation();
  const { forumId } = useParams();

  const { data: forums = [] } = useQuery({
    queryKey: ["forums"],
    queryFn: () => api.getForums(),
  });

  const forum = forums.find((f) => f.id === forumId);

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ["forum-topics", forumId],
    queryFn: () => api.getForumTopics(forumId!),
    enabled: Boolean(forumId),
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/forums" className="text-muted-foreground hover:text-primary transition-colors">
          {t("forums")}
        </Link>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{forum?.name ?? t("topics")}</h1>
      </div>

      {forum?.description && (
        <p className="text-muted-foreground">{forum.description}</p>
      )}

      {topics.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t("noTopics")}</p>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <Link key={topic.id} to={`/forums/topic/${topic.id}`}>
              <Card className="hover:shadow-glow transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold shrink-0">
                      {topic.author.full_name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{topic.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{topic.content}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{topic.author.full_name}</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {topic.replies_count} {t("replies")}
                        </span>
                        <span>
                          {new Date(topic.created_at).toLocaleDateString(
                            i18n.language === "he" ? "he-IL" : "en-US"
                          )}
                        </span>
                      </div>
                    </div>
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
