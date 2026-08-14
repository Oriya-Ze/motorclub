import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Crown, Send, Shield, Trash2, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { cn, displayName } from "@/lib/utils";

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: string, t: (key: string) => string) {
  if (role === "owner") return t("groupOwner");
  if (role === "admin") return t("groupAdmin");
  return t("groupMember");
}

export default function GroupDetailPage() {
  const { t, i18n } = useTranslation();
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: group, isLoading: groupLoading } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api.getGroup(groupId!),
    enabled: Boolean(groupId),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => api.getGroupMembers(groupId!),
    enabled: Boolean(groupId && group?.is_member),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: () => api.getGroupMessages(groupId!),
    enabled: Boolean(groupId && group?.is_member),
    refetchInterval: group?.is_member ? 5000 : false,
  });

  const invalidateGroup = () => {
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
  };

  const joinGroup = useMutation({
    mutationFn: () => api.joinGroup(groupId!),
    onSuccess: () => {
      invalidateGroup();
      toast.success(t("joinedGroup"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const leaveGroup = useMutation({
    mutationFn: () => api.leaveGroup(groupId!),
    onSuccess: () => {
      invalidateGroup();
      queryClient.removeQueries({ queryKey: ["group-messages", groupId] });
      toast.success(t("leftGroup"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteGroup = useMutation({
    mutationFn: () => api.deleteGroup(groupId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success(t("groupDeleted"));
      navigate("/groups");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.removeGroupMember(groupId!, userId),
    onSuccess: () => {
      invalidateGroup();
      toast.success(t("memberRemoved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "member" | "admin" }) =>
      api.updateGroupMemberRole(groupId!, userId, role),
    onSuccess: (_, { role }) => {
      invalidateGroup();
      toast.success(role === "admin" ? t("memberPromoted") : t("memberDemoted"));
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

  if (groupLoading) {
    return <ListPageSkeleton rows={4} />;
  }

  if (!group) {
    return <div className="text-center py-12 text-muted-foreground">{t("groupNotFound")}</div>;
  }

  const isOwner = group.my_role === "owner";
  const canManage = group.can_manage;

  const canKick = (targetRole: string, targetUserId: string) => {
    if (targetRole === "owner" || targetUserId === user?.id) return false;
    if (isOwner) return true;
    if (group.my_role === "admin" && targetRole === "member") return true;
    return false;
  };

  const canPromote = (targetRole: string) => isOwner && targetRole === "member";
  const canDemote = (targetRole: string) => isOwner && targetRole === "admin";

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 md:pb-6">
      <div className="flex items-center gap-2">
        <Link to="/groups" className="text-muted-foreground hover:text-primary">{t("groups")}</Link>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <h1 className="text-2xl font-display tracking-wide">{group.name}</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {group.description && <p className="text-muted-foreground">{group.description}</p>}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {group.members_count} {t("members")}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {group.is_member ? (
                group.my_role !== "owner" && (
                  <Button size="sm" variant="outline" onClick={() => leaveGroup.mutate()} disabled={leaveGroup.isPending}>
                    {t("leaveGroup")}
                  </Button>
                )
              ) : (
                <Button size="sm" variant="outline" onClick={() => joinGroup.mutate()} disabled={joinGroup.isPending}>
                  {t("joinGroup")}
                </Button>
              )}
              {isOwner && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm(t("confirmDeleteGroup"))) deleteGroup.mutate();
                  }}
                  disabled={deleteGroup.isPending}
                >
                  <Trash2 className="w-4 h-4 me-1" />
                  {t("deleteGroup")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {group.is_member && members.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="font-semibold">{t("members")}</h2>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                  <Link to={`/profile/${member.user_id}`}>
                    <Avatar user={member.user} size="sm" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/profile/${member.user_id}`} className="text-sm font-medium hover:text-primary truncate block">
                      {displayName(member.user)}
                    </Link>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {member.role === "owner" && <Crown className="w-3 h-3 text-amber-500" />}
                      {member.role === "admin" && <Shield className="w-3 h-3 text-primary" />}
                      {roleLabel(member.role, t)}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      {canPromote(member.role) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={updateRole.isPending}
                          onClick={() => updateRole.mutate({ userId: member.user_id, role: "admin" })}
                        >
                          {t("promoteToAdmin")}
                        </Button>
                      )}
                      {canDemote(member.role) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          disabled={updateRole.isPending}
                          onClick={() => updateRole.mutate({ userId: member.user_id, role: "member" })}
                        >
                          {t("demoteToMember")}
                        </Button>
                      )}
                      {canKick(member.role, member.user_id) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={removeMember.isPending}
                          onClick={() => {
                            if (window.confirm(t("confirmRemoveMember"))) {
                              removeMember.mutate(member.user_id);
                            }
                          }}
                          aria-label={t("removeMember")}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="flex flex-col min-h-[400px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
          {!group.is_member ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("joinGroupToChat")}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("noGroupMessages")}</p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.user_id === user?.id;
              return (
                <div key={msg.id} className={cn("flex gap-2", isMine && "flex-row-reverse")}>
                  <Avatar user={msg.author} size="sm" />
                  <div className={cn("max-w-[75%]", isMine && "text-end")}>
                    <p className="text-xs text-muted-foreground mb-0.5">{msg.author.full_name}</p>
                    <div className={cn("rounded-2xl px-4 py-2 text-sm inline-block", isMine ? "bg-primary text-primary-foreground" : "bg-muted")}>
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
            placeholder={group.is_member ? t("typeMessage") : t("joinGroup")}
            className="h-10"
            disabled={!group.is_member}
          />
          <Button type="submit" size="icon" disabled={!group.is_member || !message.trim() || sendMessage.isPending}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
