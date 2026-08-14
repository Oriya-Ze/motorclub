import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, MessageSquare, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { forumDescription, forumName } from "@/lib/forum";

export default function ForumTopicsPage() {
  const { t, i18n } = useTranslation();
  const { forumId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

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

  const createTopic = useMutation({
    mutationFn: () => api.createTopic(forumId!, title.trim(), content.trim()),
    onSuccess: (topic) => {
      queryClient.invalidateQueries({ queryKey: ["forum-topics", forumId] });
      queryClient.invalidateQueries({ queryKey: ["forums"] });
      toast.success(t("topicCreated"));
      setShowCreate(false);
      setTitle("");
      setContent("");
      navigate(`/forums/topic/${topic.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <ListPageSkeleton rows={4} />;
  }

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/forums" className="text-muted-foreground hover:text-primary transition-colors shrink-0">
            {t("forums")}
          </Link>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          <h1 className="text-2xl font-display tracking-wide truncate">
            {forum ? forumName(forum, i18n.language) : t("topics")}
          </h1>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          {t("createTopic")}
        </Button>
      </div>

      {forum && forumDescription(forum, i18n.language) && (
        <p className="text-muted-foreground">{forumDescription(forum, i18n.language)}</p>
      )}

      {topics.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("noTopics")}
          action={<Button onClick={() => setShowCreate(true)}>{t("createTopic")}</Button>}
        />
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <Link key={topic.id} to={`/forums/topic/${topic.id}`}>
              <Card className="hover:shadow-glow transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Avatar user={topic.author} size="md" />
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

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("createTopic")}</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("topicTitle")}
              className="h-11"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("topicContent")}
              rows={4}
              className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <Button
              className="w-full"
              disabled={title.trim().length < 3 || !content.trim() || createTopic.isPending}
              onClick={() => createTopic.mutate()}
            >
              {t("publish")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
