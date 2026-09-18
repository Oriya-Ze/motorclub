import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { displayName, formatHandle } from "@/lib/utils";

type FollowListKind = "followers" | "following";

interface FollowersSheetProps {
  open: boolean;
  kind: FollowListKind;
  userId: string;
  onClose: () => void;
}

export default function FollowersSheet({ open, kind, userId, onClose }: FollowersSheetProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data = [], isLoading } = useQuery({
    queryKey: [kind, userId],
    queryFn: () => (kind === "followers" ? api.getFollowers(userId) : api.getFollowing(userId)),
    enabled: open && Boolean(userId),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold">{t(`profile.${kind}`)}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto space-y-1 min-h-[12rem]">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("loading")}</p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {kind === "followers" ? t("profile.noFollowers") : t("profile.noFollowing")}
            </p>
          ) : (
            data.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-1 py-2">
                <Link to={`/profile/${u.id}`} onClick={onClose} className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar user={u} size="sm" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{displayName(u)}</span>
                    <span className="block text-xs text-muted-foreground truncate">{formatHandle(u)}</span>
                  </span>
                </Link>
                {user && user.id !== u.id && <FollowButton userId={u.id} />}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
