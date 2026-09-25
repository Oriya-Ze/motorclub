import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Mail, MessageSquare, Send, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { MessageText, SharedPostPreview, firstPostUrl } from "@/components/MessageBody";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, type ConversationSummary, type User } from "@/lib/api";
import { cn, displayName, formatHandle } from "@/lib/utils";

function dayKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayKey(iso: string) {
  return dayKeyFromDate(new Date(iso));
}

function formatDayLabel(iso: string, language: string, t: (key: string, opts?: Record<string, string>) => string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKeyFromDate(today)) return t("messageToday");
  if (dayKey(iso) === dayKeyFromDate(yesterday)) return t("messageYesterday");
  return date.toLocaleDateString(language === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
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
        "max-md:hidden fixed top-24 xl:top-36 start-0 z-[55] group",
        "flex flex-col items-center justify-center gap-1.5 py-3 px-2.5 min-w-[3rem]",
        "bg-card/95 backdrop-blur-md border border-primary/25 border-s-0",
        "rounded-e-2xl shadow-glow",
        "hover:border-primary/50 hover:bg-primary/5 transition-all duration-200",
        unreadTotal > 0 && "border-primary/45"
      )}
      aria-label={t("messages")}
    >
      <span className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
        <Mail className="w-[18px] h-[18px] text-primary" />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -end-1 min-w-[1.125rem] h-[1.125rem] px-0.5 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-card">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </span>
      <span className="text-[10px] font-semibold text-primary tracking-wide [writing-mode:vertical-rl] rotate-180">
        {t("messages")}
      </span>
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
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [message, setMessage] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      openerRef.current?.focus();
    };
  }, [onClose]);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
    refetchInterval: 10000,
  });

  const activeConversation = conversations.find((c) => c.id === conversationId);

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
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

  const recipientSearch = recipientQuery.trim();
  const { data: recipientResults = [], isFetching: recipientsLoading } = useQuery({
    queryKey: ["user-search", recipientSearch],
    queryFn: () => api.searchUsers(recipientSearch),
    enabled: recipientSearch.length >= 1,
  });

  const showChat = Boolean(conversationId && activeConversation);

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-[100] w-full max-w-sm min-w-0 overflow-x-hidden messages-panel-enter",
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
            ref={closeRef}
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

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 min-h-0 min-w-0">
              {messagesLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("messagesLoading")}</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("noMessages")}</p>
              ) : (
                messages.map((msg, index) => {
                  const isMine = msg.sender_id === user?.id;
                  const showDay = index === 0 || dayKey(msg.created_at) !== dayKey(messages[index - 1].created_at);
                  const previewHref = firstPostUrl(msg.content ?? "");
                  return (
                    <div key={msg.id} className="min-w-0">
                      {showDay && (
                        <p className="text-center text-xs text-muted-foreground py-2">{formatDayLabel(msg.created_at, i18n.language, t)}</p>
                      )}
                      <div className={cn("flex min-w-0", isMine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] min-w-0 rounded-2xl px-4 py-2 text-sm overflow-hidden",
                            isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                          )}
                        >
                          <MessageText content={msg.content ?? ""} mine={isMine} />
                          {previewHref ? <SharedPostPreview href={previewHref} /> : null}
                          <p className={cn("text-[10px] mt-1", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            {formatTime(msg.created_at, i18n.language)}
                          </p>
                        </div>
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
                if (!message.trim() || sendMessage.isPending) return;
                sendMessage.mutate(message.trim());
              }}
            >
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("typeMessage")}
                className="h-10"
              />
              <Button type="submit" size="icon" disabled={!message.trim() || sendMessage.isPending} aria-label={t("sendMessage")}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="p-3 border-b border-border/40 shrink-0">
              <Input
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                placeholder={t("searchUsers")}
                className="h-10"
                aria-label={t("searchUsers")}
              />
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t("messagesLoading")}</p>
              ) : (
                <InboxResults
                  query={recipientSearch}
                  conversations={conversations}
                  users={recipientResults.filter((person) => person.id !== user?.id)}
                  usersLoading={recipientsLoading}
                  onOpenConversation={onConversationChange}
                  onStart={async (userId) => {
                    if (userId === user?.id) return;
                    try {
                      const conv = await api.startConversation(userId);
                      queryClient.invalidateQueries({ queryKey: ["conversations"] });
                      onConversationChange(conv.id);
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : t("error"));
                    }
                  }}
                />
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function InboxResults({
  query,
  conversations,
  users,
  usersLoading,
  onOpenConversation,
  onStart,
}: {
  query: string;
  conversations: ConversationSummary[];
  users: User[];
  usersLoading: boolean;
  onOpenConversation: (id: string) => void;
  onStart: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const needle = query.toLowerCase();
  const matchedConversations = needle
    ? conversations.filter((conv) =>
        `${conv.other_user.full_name} ${conv.other_user.username ?? ""}`.toLowerCase().includes(needle),
      )
    : conversations;
  const conversationUserIds = new Set(matchedConversations.map((conv) => conv.other_user.id));
  const newUsers = needle ? users.filter((person) => !conversationUserIds.has(person.id)) : [];

  if (!needle && matchedConversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-muted-foreground">
        <MessageSquare className="w-10 h-10 opacity-40" />
        <p className="text-sm text-center">{t("noConversations")}</p>
        <p className="text-xs text-center">{t("searchUsersHint")}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">{t("messageSearchConversations")}</p>
      {matchedConversations.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{t("noConversations")}</p>
      ) : (
        matchedConversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            onClick={() => onOpenConversation(conv.id)}
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
              <p className="text-xs text-muted-foreground truncate break-all">{conv.last_message || formatHandle(conv.other_user)}</p>
            </div>
          </button>
        ))
      )}
      {needle ? (
        <>
          <p className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">{t("messageSearchUsers")}</p>
          {usersLoading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t("messagesLoading")}</p>
          ) : newUsers.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t("noSearchResults")}</p>
          ) : (
            newUsers.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onStart(person.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 text-start"
              >
                <Avatar user={person} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{displayName(person)}</p>
                  <p className="text-xs text-muted-foreground truncate">{formatHandle(person)}</p>
                </div>
              </button>
            ))
          )}
        </>
      ) : null}
    </div>
  );
}