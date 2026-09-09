import { useQuery } from "@tanstack/react-query";
import { Bell, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useMessagesPanel } from "@/components/MessagesPanel";
import { api } from "@/lib/api";

export default function MobileHeaderActions() {
  const { t } = useTranslation();
  const { openMessages } = useMessagesPanel();

  const { data: unread } = useQuery({
    queryKey: ["unread-count"],
    queryFn: () => api.getUnreadCount(),
    refetchInterval: 30000,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.getConversations(),
    refetchInterval: 30000,
  });

  const messagesUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="flex items-center gap-0.5 md:hidden">
      <button
        type="button"
        onClick={() => openMessages()}
        className="relative p-2.5 rounded-xl hover:bg-muted/50 text-foreground"
        aria-label={t("messages")}
      >
        <Mail className="w-5 h-5" />
        {messagesUnread > 0 && (
          <span className="absolute top-1.5 end-1.5 min-w-[1rem] h-4 px-0.5 bg-primary text-white text-[9px] rounded-full flex items-center justify-center">
            {messagesUnread > 9 ? "9+" : messagesUnread}
          </span>
        )}
      </button>
      <Link to="/notifications" className="relative p-2.5 rounded-xl hover:bg-muted/50">
        <Bell className="w-5 h-5" />
        {(unread?.count ?? 0) > 0 && (
          <span className="absolute top-1.5 end-1.5 min-w-[1rem] h-4 px-0.5 bg-primary text-white text-[9px] rounded-full flex items-center justify-center">
            {unread!.count > 9 ? "9+" : unread!.count}
          </span>
        )}
      </Link>
    </div>
  );
}
