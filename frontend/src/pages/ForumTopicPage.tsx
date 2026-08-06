import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle, Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ForumTopicPage() {
  const { t, i18n } = useTranslation();
  const { topicId } = useParams();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");

  const { data: forums = [] } = useQuery({
    queryKey: ["forums"],
    queryFn: () => api.getForums(),
  });

  const { data: allTopics = [] } = useQuery({
    queryKey: ["all-forum-topics"],
    queryFn: async () => {
      const results = await Promise.all(forums.map((f) => api.getForumTopics(f.id)));
      return results.flat();
    },
    enabled: forums.length > 0,
  });

  const topic = allTopics.find((t) => t.id === topicId);
  const forum = forums.find((f) => f.id === topic?.forum_id);

  const { data: replies = [], isLoading } = useQuery({
    queryKey: ["topic-replies", topicId],
    queryFn: () => api.getTopicReplies(topicId!),
    enabled: Boolean(topicId),
  });

  const createReply = useMutation({
    mutationFn: (content: string) => api.createTopicReply(topicId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topic-replies", topicId] });
      setReply("");
      toast.success(t("replyPosted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !topic) {
    return isLoading ? <ListPageSkeleton rows={3} /> : <div className="text-center py-12 text-muted-foreground">{t("topicNotFound")}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Link to="/forums" className="text-muted-foreground hover:text-primary">{t("forums")}</Link>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        {forum && (
          <>
            <Link to={`/forums/${forum.id}`} className="text-muted-foreground hover:text-primary">{forum.name}</Link>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </>
        )}
        <span className="font-medium truncate">{topic.title}</span>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold shrink-0">
              {topic.author.full_name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{topic.title}</h1>
              <p className="text-sm text-muted-foreground">
                {topic.author.full_name} ·{" "}
                {new Date(topic.created_at).toLocaleDateString(i18n.language === "he" ? "he-IL" : "en-US")}
              </p>
            </div>
          </div>
          <p className="whitespace-pre-wrap">{topic.content}</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="font-semibold mb-4">{replies.length} {t("replies")}</h2>
        <div className="space-y-3">
          {replies.map((r) => (
            <Card key={r.id} className={cn(r.is_best_answer && "border-primary/50")}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {r.author.full_name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{r.author.full_name}</span>
                      {r.is_best_answer && (
                        <span className="inline-flex items-center gap-1 text-xs text-primary">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {t("bestAnswer")}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{r.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim()) createReply.mutate(reply.trim());
            }}
          >
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={t("writeReply")}
              className="h-10"
            />
            <Button type="submit" disabled={!reply.trim() || createReply.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
