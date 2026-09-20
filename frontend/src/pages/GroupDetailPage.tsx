import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Crown, Lock, MessageCircle, MoreHorizontal, Send, Share2, Shield, Trash2, UserMinus, Users, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import { GroupMark } from "@/components/GroupCard";
import ShareSheet from "@/components/ShareSheet";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ListPageSkeleton } from "@/components/Skeleton";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, User } from "@/lib/api";
import { cn, displayName } from "@/lib/utils";

type Tab = "chat" | "members" | "about";

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string | undefined, locale: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function roleLabel(role: string, t: (key: string) => string) {
  if (role === "owner") return t("groupOwner");
  if (role === "admin") return t("groupAdmin");
  return t("groupMember");
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Users; title: string; hint?: string }) {
  return (
    <div className="text-center py-12 px-4 space-y-2">
      <Icon className="w-10 h-10 mx-auto text-muted-foreground/50" />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function GroupDetailPage() {
  const { t, i18n } = useTranslation();
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = tabParam === "members" || tabParam === "about" ? tabParam : "chat";
  const [message, setMessage] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const setTab = (next: Tab) => {
    setSearchParams(next === "chat" ? {} : { tab: next }, { replace: true });
  };

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

  const { data: joinRequests = [] } = useQuery({
    queryKey: ["group-join-requests", groupId],
    queryFn: () => api.getGroupJoinRequests(groupId!),
    enabled: Boolean(groupId && group?.can_manage && group?.privacy === "closed"),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: () => api.getGroupMessages(groupId!),
    enabled: Boolean(groupId && group?.is_member && tab === "chat"),
    refetchInterval: group?.is_member && tab === "chat" ? 5000 : false,
  });

  useEffect(() => {
    if (!showMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showMenu]);

  useEffect(() => {
    if (tab !== "chat") return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, tab]);

  const invalidateGroup = () => {
    queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    queryClient.invalidateQueries({ queryKey: ["group-join-requests", groupId] });
  };

  const joinGroup = useMutation({
    mutationFn: () => api.joinGroup(groupId!),
    onSuccess: (data) => {
      invalidateGroup();
      toast.success(data.status === "pending" ? t("groupJoinRequested") : t("joinedGroup"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const leaveGroup = useMutation({
    mutationFn: () => api.leaveGroup(groupId!),
    onSuccess: (data) => {
      invalidateGroup();
      queryClient.removeQueries({ queryKey: ["group-messages", groupId] });
      toast.success(data.status === "cancelled" ? t("groupJoinCancelled") : t("leftGroup"));
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

  const approveRequest = useMutation({
    mutationFn: (userId: string) => api.approveGroupJoinRequest(groupId!, userId),
    onSuccess: () => {
      invalidateGroup();
      toast.success(t("groupJoinApproved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectRequest = useMutation({
    mutationFn: (userId: string) => api.rejectGroupJoinRequest(groupId!, userId),
    onSuccess: () => {
      invalidateGroup();
      toast.success(t("groupJoinRejected"));
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
  const canManage = Boolean(group.can_manage);
  const isPending = group.my_status === "pending";
  const isPrivate = group.privacy === "closed";
  const groupUrl = `${window.location.origin}/groups/${group.id}`;
  const pendingCount = group.pending_count ?? joinRequests.length;

  const canKick = (targetRole: string, targetUserId: string) => {
    if (targetRole === "owner" || targetUserId === user?.id) return false;
    if (isOwner) return true;
    if (group.my_role === "admin" && targetRole === "member") return true;
    return false;
  };

  const canPromote = (targetRole: string) => isOwner && targetRole === "member";
  const canDemote = (targetRole: string) => isOwner && targetRole === "admin";

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "chat", label: t("groupTabChat") },
    { id: "members", label: t("groupTabMembers"), badge: canManage && isPrivate ? pendingCount : undefined },
    { id: "about", label: t("groupTabAbout") },
  ];

  const joinButton = isPending ? (
    <Button size="sm" variant="outline" onClick={() => leaveGroup.mutate()} disabled={leaveGroup.isPending}>
      {t("cancelJoinRequest")}
    </Button>
  ) : group.is_member ? null : (
    <Button size="sm" onClick={() => joinGroup.mutate()} disabled={joinGroup.isPending}>
      {isPrivate ? t("requestToJoinGroup") : t("joinGroup")}
    </Button>
  );

  return (
    <div
      className={cn(
        "max-w-2xl mx-auto flex flex-col gap-3",
        tab === "chat" ? "h-[calc(100dvh-11rem)] md:h-[calc(100dvh-8rem)]" : "pb-20 md:pb-6",
      )}
    >
      <Link to="/groups" className="inline-flex text-sm text-muted-foreground hover:text-primary shrink-0">
        {t("groups")}
      </Link>

      <Card className="overflow-hidden shrink-0">
        <div className="h-20 sm:h-24 bg-muted/70" />
        <CardContent className="relative pt-0 pb-4 px-4 sm:px-6 space-y-3">
          <div className="flex items-end gap-3 sm:gap-4 -mt-8">
            <GroupMark id={group.id} name={group.name} size="lg" className="border-4 border-card" />
            <div className="flex-1 min-w-0 pb-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-display tracking-wide leading-tight truncate">{group.name}</h1>
                {isPrivate && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    {t("groupPrivacyPrivate")}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {t("membersCount", { count: group.members_count })}
                {group.my_role && (
                  <>
                    <span aria-hidden>·</span>
                    {roleLabel(group.my_role, t)}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {joinButton}
            <Button size="sm" variant="outline" onClick={() => setShowShare(true)} aria-label={t("shareGroup")}>
              <Share2 className="w-4 h-4 me-1" />
              {t("shareGroup")}
            </Button>
            {(isOwner || (group.is_member && group.my_role !== "owner")) && (
              <div className="relative ms-auto" ref={menuRef}>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={() => setShowMenu((v) => !v)}
                  aria-label={t("groupOptions")}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
                {showMenu && (
                  <div className="absolute end-0 top-full mt-1 z-20 min-w-[180px] glass-card rounded-xl py-1">
                    {group.is_member && group.my_role !== "owner" && (
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/50 text-start"
                        onClick={() => {
                          setShowMenu(false);
                          leaveGroup.mutate();
                        }}
                      >
                        {t("leaveGroup")}
                      </button>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted/50 text-start"
                        onClick={() => {
                          setShowMenu(false);
                          if (window.confirm(t("confirmDeleteGroup"))) deleteGroup.mutate();
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t("deleteGroup")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {isPending && (
            <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-xl px-4 py-3">
              {t("groupJoinPendingHint")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border/50 shrink-0">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors",
              tab === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge ? (
              <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center">
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "chat" && (
        <Card className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!group.is_member ? (
              <EmptyState
                icon={Lock}
                title={t("groupChatLockedTitle")}
                hint={isPending ? t("groupJoinPendingHint") : t("joinGroupToChat")}
              />
            ) : messages.length === 0 ? (
              <EmptyState icon={MessageCircle} title={t("noGroupMessages")} />
            ) : (
              messages.map((msg) => {
                const isMine = msg.user_id === user?.id;
                return (
                  <div key={msg.id} className={cn("flex gap-2", isMine && "flex-row-reverse")}>
                    <Avatar user={msg.author} size="sm" />
                    <div className={cn("max-w-[75%]", isMine && "text-end")}>
                      <p className="text-xs text-muted-foreground mb-0.5">{displayName(msg.author)}</p>
                      <div className={cn("rounded-2xl px-4 py-2 text-sm inline-block", isMine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatTime(msg.created_at, i18n.language)}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          <form
            className="p-3 border-t border-border/50 flex gap-2 shrink-0"
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) sendMessage.mutate(message.trim());
            }}
          >
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={group.is_member ? t("typeMessage") : isPending ? t("groupJoinPending") : t("joinGroup")}
              className="h-10"
              disabled={!group.is_member}
            />
            <Button type="submit" size="icon" disabled={!group.is_member || !message.trim() || sendMessage.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      )}

      {tab === "members" && (
        <div className="space-y-4">
          {canManage && isPrivate && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="font-semibold">
                  {t("groupJoinRequests")}
                  {joinRequests.length > 0 && (
                    <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {joinRequests.length}
                    </span>
                  )}
                </h2>
                {joinRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("groupJoinRequestsEmpty")}</p>
                ) : (
                  <div className="space-y-1">
                    {joinRequests.map((request) => (
                      <MemberRow
                        key={request.user_id}
                        userId={request.user_id}
                        user={request.user}
                        trailing={(
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-emerald-600"
                              disabled={approveRequest.isPending || rejectRequest.isPending}
                              onClick={() => approveRequest.mutate(request.user_id)}
                              aria-label={t("approveJoinRequest")}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              disabled={approveRequest.isPending || rejectRequest.isPending}
                              onClick={() => rejectRequest.mutate(request.user_id)}
                              aria-label={t("rejectJoinRequest")}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="font-semibold">{t("members")}</h2>
              {!group.is_member ? (
                <EmptyState icon={Lock} title={t("groupMembersLockedTitle")} hint={t("joinGroupToChat")} />
              ) : members.length === 0 ? (
                <EmptyState icon={Users} title={t("groupNoMembersYet")} />
              ) : (
                <div className="space-y-1">
                  {members.map((member) => (
                    <MemberRow
                      key={member.user_id}
                      userId={member.user_id}
                      user={member.user}
                      subtitle={(
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {member.role === "owner" && <Crown className="w-3 h-3 text-amber-500" />}
                          {member.role === "admin" && <Shield className="w-3 h-3 text-primary" />}
                          {roleLabel(member.role, t)}
                        </p>
                      )}
                      trailing={canManage ? (
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
                      ) : undefined}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "about" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h2 className="font-semibold mb-2">{t("groupTabAbout")}</h2>
              <p className={cn("text-sm whitespace-pre-wrap", group.description ? "text-foreground" : "text-muted-foreground")}>
                {group.description || t("groupAboutEmpty")}
              </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{t("privacy")}</dt>
                <dd className="font-medium mt-0.5">{isPrivate ? t("groupPrivacyPrivate") : t("groupPrivacyPublic")}</dd>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{t("members")}</dt>
                <dd className="font-medium mt-0.5">{t("membersCount", { count: group.members_count })}</dd>
              </div>
              {group.created_at && (
                <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t("groupCreatedLabel")}</dt>
                  <dd className="font-medium mt-0.5">{formatDate(group.created_at, i18n.language)}</dd>
                </div>
              )}
              {group.my_role && (
                <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2.5 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t("groupYourRole")}</dt>
                  <dd className="font-medium mt-0.5">{roleLabel(group.my_role, t)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      <ShareSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        heading={t("shareGroup")}
        url={groupUrl}
        text={t("shareGroupMessage").replace("{name}", group.name)}
        sentToastKey="groupSharedToUser"
      />
    </div>
  );
}

function MemberRow({
  userId,
  user,
  subtitle,
  trailing,
}: {
  userId: string;
  user: User;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <Link to={`/profile/${userId}`}>
        <Avatar user={user} size="sm" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={`/profile/${userId}`} className="text-sm font-medium hover:text-primary truncate block">
          {displayName(user)}
        </Link>
        {subtitle}
      </div>
      {trailing}
    </div>
  );
}
