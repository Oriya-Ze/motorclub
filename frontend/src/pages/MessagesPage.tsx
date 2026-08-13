import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn, formatHandle } from "@/lib/utils";

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessagesPage() {
  const { t, i18n } = useTranslation();
  const { conversationId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
  });

  const activeConversation = conversations.find((c) => c.id === conversationId);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.getConversationMessages(conversationId!),
    enabled: Boolean(conversationId),
    refetchInterval: 5000,
  });

  const sendMessage = useMutation({
    mutationFn: (content: string) => api.sendDirectMessage(conversationId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setMessage("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <ListPageSkeleton rows={5} />;
  }

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-8rem)]">
      <Card className="overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border/50">
          <h1 className="font-display text-2xl tracking-wide">{t("messages")}</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">{t("noConversations")}</p>
          ) : (
            conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/messages/${conv.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30",
                  conversationId === conv.id && "bg-primary/10"
                )}
              >
                <Avatar user={conv.other_user} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{conv.other_user.full_name}</p>
                    {conv.unread_count > 0 && (
                      <span className="text-xs bg-primary text-white rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.last_message || formatHandle(conv.other_user)}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </Card>

      <Card className="overflow-hidden flex flex-col">
        {conversationId && activeConversation ? (
          <>
            <div className="p-4 border-b border-border/50 flex items-center gap-3">
              <Link to={`/profile/${activeConversation.other_user.id}`} className="flex items-center gap-3 hover:opacity-80">
                <Avatar user={activeConversation.other_user} size="sm" />
                <div>
                  <p className="font-semibold">{activeConversation.other_user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{formatHandle(activeConversation.other_user)}</p>
                </div>
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("noMessages")}</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                          isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className={cn("text-[10px] mt-1", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {formatTime(msg.created_at, i18n.language)}
                        </p>
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
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="w-12 h-12 opacity-40" />
            <p>{t("selectConversation")}</p>
            <Link to="/" className="text-sm text-primary flex items-center gap-1 hover:underline">
              <ArrowRight className="w-4 h-4" />
              {t("searchUsersHint")}
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
