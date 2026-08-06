import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Send, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GroupDetailPage() {
  const { t, i18n } = useTranslation();
  const { groupId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => api.getGroups(),
  });

  const group = groups.find((g) => g.id === groupId);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: () => api.getGroupMessages(groupId!),
    enabled: Boolean(groupId),
    refetchInterval: 5000,
  });

  const joinGroup = useMutation({
    mutationFn: () => api.joinGroup(groupId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(t("joinedGroup"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => api.sendGroupMessage(groupId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
      setMessage("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!group) {
    return isLoading ? <ListPageSkeleton rows={4} /> : <div className="text-center py-12 text-muted-foreground">{t("groupNotFound")}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/groups" className="text-muted-foreground hover:text-primary">{t("groups")}</Link>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{group.name}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          {group.description && <p className="text-muted-foreground mb-4">{group.description}</p>}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {group.members_count} {t("members")}
            </div>
            <Button size="sm" variant="outline" onClick={() => joinGroup.mutate()} disabled={joinGroup.isPending}>
              {t("joinGroup")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("noGroupMessages")}</p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.user_id === user?.id;
              return (
                <div key={msg.id} className={cn("flex gap-2", isMine && "flex-row-reverse")}>
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {msg.author.full_name[0]?.toUpperCase()}
                  </div>
                  <div className={cn("max-w-[75%]", isMine && "text-end")}>
                    <p className="text-xs text-muted-foreground mb-0.5">{msg.author.full_name}</p>
                    <div className={cn("rounded-2xl px-4 py-2 text-sm inline-block", isMine ? "gradient-primary text-white" : "bg-muted")}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(msg.created_at, i18n.language)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          className="p-4 border-t border-border/50 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (message.trim()) sendMessage.mutate(message.trim());
          }}
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("typeMessage")}
            className="h-10"
          />
          <Button type="submit" size="icon" disabled={!message.trim() || sendMessage.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
