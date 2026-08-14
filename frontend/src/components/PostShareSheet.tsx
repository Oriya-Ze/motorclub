import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, Share2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMessagesPanelOptional } from "@/components/MessagesPanel";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, Post, User } from "@/lib/api";
import { displayName } from "@/lib/utils";

interface PostShareSheetProps {
  post: Post;
  open: boolean;
  onClose: () => void;
}

function postUrl(postId: string) {
  return `${window.location.origin}/posts/${postId}`;
}

function shareText(post: Post, t: (key: string) => string) {
  const author = post.author.full_name;
  const snippet = post.content?.slice(0, 120) ?? "";
  return snippet
    ? t("sharePostMessageWithContent").replace("{author}", author).replace("{content}", snippet)
    : t("sharePostMessage").replace("{author}", author);
}

export default function PostShareSheet({ post, open, onClose }: PostShareSheetProps) {
  const { t } = useTranslation();
  const messagesPanel = useMessagesPanelOptional();
  const [search, setSearch] = useState("");
  const url = postUrl(post.id);
  const text = shareText(post, t);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
    enabled: open,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["users-search", search],
    queryFn: () => api.searchUsers(search),
    enabled: open && search.trim().length >= 2,
  });

  const sendToUser = useMutation({
    mutationFn: async (targetUser: User) => {
      const conv = await api.startConversation(targetUser.id);
      await api.sendDirectMessage(conv.id, `${text}\n${url}`);
      return conv.id;
    },
    onSuccess: (conversationId) => {
      toast.success(t("postSharedToUser"));
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

  const pickTargets: User[] = search.trim().length >= 2
    ? searchResults
    : conversations.map((c) => c.other_user);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("sharePost")}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
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

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("sendToUser")}</p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchUsers")}
            className="h-10"
          />
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {pickTargets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("noSearchResults")}</p>
            ) : (
              pickTargets.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={sendToUser.isPending}
                  onClick={() => sendToUser.mutate(u)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 transition-colors text-start"
                >
                  <Avatar user={u} size="sm" />
                  <span className="text-sm font-medium truncate">{displayName(u)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
