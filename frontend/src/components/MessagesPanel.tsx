import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Mail, MessageSquare, Send, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import UserSearch from "@/components/UserSearch";
import { Button } from "@/components/ui/Button";
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

interface MessagesPanelContextValue {
  openMessages: (conversationId?: string) => void;
  closeMessages: () => void;
}

const MessagesPanelContext = createContext<MessagesPanelContextValue | null>(null);

export function useMessagesPanel() {
  const ctx = useContext(MessagesPanelContext);
  if (!ctx) throw new Error("useMessagesPanel must be used within MessagesPanelProvider");
  return ctx;
}

export function useMessagesPanelOptional() {
  return useContext(MessagesPanelContext);
}

export function MessagesPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const openMessages = useCallback((id?: string) => {
    setConversationId(id);
    setOpen(true);
  }, []);

  const closeMessages = useCallback(() => {
    setOpen(false);
  }, []);

  return (
    <MessagesPanelContext.Provider value={{ openMessages, closeMessages }}>
      {children}
      {open && (
        <MessagesPanel
          conversationId={conversationId}
          onClose={closeMessages}
          onConversationChange={setConversationId}
        />
      )}
    </MessagesPanelContext.Provider>
  );
}

export function MessagesSideButton() {
  const { t } = useTranslation();
  const { openMessages } = useMessagesPanel();

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
    refetchInterval: 30000,
  });

  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return createPortal(
    <button
      type="button"
      onClick={() => openMessages()}
      className={cn(
        "max-md:hidden fixed top-20 xl:top-32 start-0 z-[55]",
        "flex items-center justify-center w-10 h-10",
        "bg-card/95 backdrop-blur-sm border border-border/50 border-s-0",
        "rounded-e-xl shadow-sm hover:bg-muted/60 transition-colors"
      )}
      aria-label={t("messages")}
    >
      <Mail className="w-[18px] h-[18px] text-foreground/80" />
      {unreadTotal > 0 && (
        <span className="absolute top-1 end-1 min-w-[1rem] h-4 px-0.5 bg-primary text-white text-[9px] font-semibold rounded-full flex items-center justify-center">
          {unreadTotal > 9 ? "9+" : unreadTotal}
        </span>
      )}
    </button>,
    document.body
  );
}

interface MessagesPanelProps {
  conversationId?: string;
  onClose: () => void;
  onConversationChange: (id: string | undefined) => void;
}

function MessagesPanel({ conversationId, onClose, onConversationChange }: MessagesPanelProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
    refetchInterval: 10000,
  });

  const activeConversation = conversations.find((c) => c.id === conversationId);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.getConversationMessages(conversationId!),
    enabled: Boolean(conversationId),
    refetchInterval: conversationId ? 5000 : false,
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

  const showChat = Boolean(conversationId && activeConversation);

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-[100] w-full max-w-sm messages-panel-enter",
          "bg-card border-e border-border/60 shadow-2xl flex flex-col"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t("messages")}
      >
        <div className="flex items-center justify-between gap-2 p-4 border-b border-border/50 shrink-0">
          {showChat ? (
            <button
              type="button"
              onClick={() => onConversationChange(undefined)}
              className="p-2 -m-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
              aria-label={t("back")}
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <h2 className="font-display text-xl tracking-wide">{t("messages")}</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground"
            aria-label={t("close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showChat ? (
          <>
            <div className="p-4 border-b border-border/50 flex items-center gap-3 shrink-0">
              <Link
                to={`/profile/${activeConversation!.other_user.id}`}
                onClick={onClose}
                className="flex items-center gap-3 hover:opacity-80 min-w-0"
              >
                <Avatar user={activeConversation!.other_user} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold truncate">{activeConversation!.other_user.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{formatHandle(activeConversation!.other_user)}</p>
                </div>
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("noMessages")}</p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
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
              className="p-4 border-t border-border/50 flex gap-2 shrink-0"
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
          <>
            <div className="p-3 border-b border-border/40 shrink-0">
              <UserSearch
                className="max-w-none"
                onUserSelect={async (userId) => {
                  try {
                    const conv = await api.startConversation(userId);
                    queryClient.invalidateQueries({ queryKey: ["conversations"] });
                    onConversationChange(conv.id);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : t("error"));
                  }
                }}
              />
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">...</p>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 opacity-40" />
                  <p className="text-sm text-center">{t("noConversations")}</p>
                  <p className="text-xs text-center">{t("searchUsersHint")}</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => onConversationChange(conv.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 text-start"
                  >
                    <Avatar user={conv.other_user} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{conv.other_user.full_name}</p>
                        {conv.unread_count > 0 && (
                          <span className="text-xs bg-primary text-white rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center shrink-0">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.last_message || formatHandle(conv.other_user)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}