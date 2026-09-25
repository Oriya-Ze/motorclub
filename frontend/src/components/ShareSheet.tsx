import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMessagesPanelOptional } from "@/components/MessagesPanel";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, User } from "@/lib/api";
import { displayName } from "@/lib/utils";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  heading: string;
  url: string;
  text: string;
  sentToastKey?: string;
}

export default function ShareSheet({
  open,
  onClose,
  heading,
  url,
  text,
  sentToastKey = "postSharedToUser",
}: ShareSheetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const messagesPanel = useMessagesPanelOptional();
  const [search, setSearch] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, [open, onClose]);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
    enabled: open && Boolean(user),
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["users-search", search],
    queryFn: () => api.searchUsers(search),
    enabled: open && Boolean(user) && search.trim().length >= 2,
  });

  const sendToUser = useMutation({
    mutationFn: async (targetUser: User) => {
      if (targetUser.id === user?.id) throw new Error(t("apiErrors.cannotMessageSelf"));
      const conv = await api.startConversation(targetUser.id);
      await api.sendDirectMessage(conv.id, `${text}\n${url}`);
      return conv.id;
    },
    onSuccess: (conversationId) => {
      toast.success(t(sentToastKey));
      onClose();
      messagesPanel?.openMessages(conversationId);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) return null;

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    toast.success(t("linkCopied"));
    onClose();
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener,noreferrer");
    onClose();
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "MotorClub", text, url });
        onClose();
      } catch {
        /* user cancelled */
      }
    } else {
      await copyLink();
    }
  };

  const needle = search.trim().toLowerCase();
  const matchedConversations = needle
    ? conversations.filter((conv) => conv.other_user.full_name.toLowerCase().includes(needle) || (conv.other_user.username ?? "").toLowerCase().includes(needle))
    : conversations;
  const knownIds = new Set(conversations.map((conv) => conv.other_user.id));
  const people = (needle ? searchResults : []).filter((person) => person.id !== user?.id && !knownIds.has(person.id));

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto overflow-x-hidden"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{heading}</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label={t("close")}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="justify-start gap-2 h-11" onClick={copyLink}>
            <Copy className="w-4 h-4" />
            {t("copyLink")}
          </Button>
          <Button variant="outline" className="justify-start gap-2 h-11" onClick={shareWhatsApp}>
            <MessageCircle className="w-4 h-4 text-green-500" />
            WhatsApp
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button variant="outline" className="justify-start gap-2 h-11 col-span-2" onClick={shareNative}>
              <Share2 className="w-4 h-4" />
              {t("shareViaApps")}
            </Button>
          )}
        </div>

        {user && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("sendToUser")}</p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchUsers")}
            className="h-10"
          />
          <div className="space-y-1 max-h-48 overflow-y-auto overflow-x-hidden">
            {!needle && matchedConversations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("noConversations")}</p>
            ) : null}
            {matchedConversations.length > 0 ? (
              <>
                <p className="px-1 text-xs font-medium text-muted-foreground">{t("messageSearchConversations")}</p>
                {matchedConversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    disabled={sendToUser.isPending}
                    onClick={() => sendToUser.mutate(conv.other_user)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-start"
                  >
                    <Avatar user={conv.other_user} size="sm" />
                    <span className="text-sm font-medium truncate">{displayName(conv.other_user)}</span>
                  </button>
                ))}
              </>
            ) : null}
            {needle ? (
              <>
                <p className="px-1 pt-2 text-xs font-medium text-muted-foreground">{t("messageSearchUsers")}</p>
                {people.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">{t("noSearchResults")}</p>
                ) : (
                  people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      disabled={sendToUser.isPending}
                      onClick={() => sendToUser.mutate(person)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-start"
                    >
                      <Avatar user={person} size="sm" />
                      <span className="text-sm font-medium truncate">{displayName(person)}</span>
                    </button>
                  ))
                )}
              </>
            ) : null}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
