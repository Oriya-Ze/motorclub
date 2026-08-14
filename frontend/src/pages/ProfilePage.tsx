import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Car, Mail, User as UserIcon, Warehouse } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useMessagesPanelOptional } from "@/components/MessagesPanel";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import VehicleDetailModal from "@/components/VehicleDetailModal";
import Avatar from "@/components/Avatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import VehiclePlaceholder from "@/components/VehiclePlaceholder";
import { ProfileSkeleton, PostSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { api, Post, Vehicle } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { cn, displayName, formatHandle } from "@/lib/utils";

type Tab = "posts" | "saved" | "garage";

export default function ProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const messagesPanel = useMessagesPanelOptional();
  const { user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("posts");
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  const profileUserId = userId ?? authUser?.id;
  const isOwnProfile = Boolean(authUser && profileUserId === authUser.id);

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["user", profileUserId],
    queryFn: () => api.getUser(profileUserId!),
    enabled: Boolean(profileUserId),
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["user-posts", profileUserId],
    queryFn: () => api.getPosts({ userId: profileUserId! }),
    enabled: Boolean(profileUserId),
  });

  const postCount = posts.length;

  const { data: savedPosts = [], isLoading: savedLoading } = useQuery({
    queryKey: ["saved-posts"],
    queryFn: () => api.getSavedPosts(),
    enabled: isOwnProfile && tab === "saved",
  });

  const { data: garage = [], isLoading: garageLoading } = useQuery({
    queryKey: ["garage", profileUserId],
    queryFn: () => (isOwnProfile ? api.getMyGarage() : api.getUserGarage(profileUserId!)),
    enabled: Boolean(profileUserId) && tab === "garage",
  });

  const { data: followersData } = useQuery({
    queryKey: ["followers-count", profileUserId],
    queryFn: () => api.getFollowersCount(profileUserId!),
    enabled: Boolean(profileUserId),
  });

  const { data: followingData } = useQuery({
    queryKey: ["following-count", profileUserId],
    queryFn: () => api.getFollowingCount(profileUserId!),
    enabled: Boolean(profileUserId),
  });

  const { data: followStatus } = useQuery({
    queryKey: ["follow-status", profileUserId],
    queryFn: () => api.getFollowStatus(profileUserId!),
    enabled: Boolean(profileUserId && !isOwnProfile),
  });

  const followMutation = useMutation({
    mutationFn: () => api.followUser(profileUserId!),
    onSuccess: (data) => {
      queryClient.setQueryData(["follow-status", profileUserId], data);
      queryClient.invalidateQueries({ queryKey: ["followers-count", profileUserId] });
      toast.success(data.following ? t("profile.followSuccess") : t("profile.unfollowSuccess"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const messageMutation = useMutation({
    mutationFn: () => api.startConversation(profileUserId!),
    onSuccess: (conv) => messagesPanel?.openMessages(conv.id),
    onError: (err: Error) => toast.error(err.message),
  });

  if (!authUser && !userId) return null;
  if (!profileUserId) return <div className="text-center py-12 text-muted-foreground">{t("profile.notFound")}</div>;
  if (profileLoading && !profile) return <ProfileSkeleton />;
  if (profileError || !profile) return <div className="text-center py-12 text-muted-foreground">{t("profile.notFound")}</div>;

  const accountTypeLabel = profile.account_type === "business" ? t("profile.businessAccount") : t("profile.personalAccount");

  const tabs: { id: Tab; label: string }[] = [
    { id: "posts", label: t("profile.posts") },
    ...(isOwnProfile ? [{ id: "saved" as Tab, label: t("savedPosts") }] : []),
    { id: "garage", label: t("garage.nav") },
  ];

  const loading = tab === "posts" ? postsLoading : tab === "saved" ? savedLoading : garageLoading;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <div className="shrink-0 mx-auto sm:mx-0">
              <Avatar user={profile} size="2xl" className="border-2 border-primary/30" />
            </div>

            <div className="flex-1 text-center sm:text-start space-y-3">
              <div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-2xl font-display tracking-wide">{displayName(profile)}</h1>
                  {profile.is_verified && (
                    <span className="inline-flex items-center gap-1 text-primary text-sm">
                      <VerifiedBadge className="w-5 h-5" />
                      {t("profile.verified")}
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{formatHandle(profile)}</p>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                <UserIcon className="w-3.5 h-3.5" />
                {accountTypeLabel}
              </span>

              <div className="flex items-center justify-center sm:justify-start gap-6 pt-2">
                <div className="text-center">
                  <p className="text-xl font-bold">{postCount}</p>
                  <p className="text-xs text-muted-foreground">{t("profile.posts")}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{followersData?.count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("profile.followers")}</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">{followingData?.count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t("profile.following")}</p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                {isOwnProfile ? (
                  <>
                    <Link to="/settings"><Button variant="outline" size="sm">{t("profile.editProfile")}</Button></Link>
                    <Link to="/garage"><Button variant="outline" size="sm"><Warehouse className="w-4 h-4" />{t("garage.viewGarage")}</Button></Link>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant={followStatus?.following ? "outline" : "default"} disabled={followMutation.isPending} onClick={() => followMutation.mutate()}>
                      {followStatus?.following ? t("profile.unfollow") : t("profile.follow")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={messageMutation.isPending} onClick={() => messageMutation.mutate()}>
                      <Mail className="w-4 h-4" />
                      {t("sendMessage")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex border-b border-border/50">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5",
              tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >
            {id === "saved" && <Bookmark className="w-4 h-4" />}
            {id === "garage" && <Car className="w-4 h-4" />}
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : tab === "garage" ? (
        garage.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {isOwnProfile ? (
              <Link to="/garage" className="text-primary hover:underline">{t("garage.add")}</Link>
            ) : (
              t("garage.empty")
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {garage.map((v: Vehicle) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVehicle(v)}
                className="text-start rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <Card className="overflow-hidden hover:shadow-glow transition-shadow h-full cursor-pointer">
                  {v.image_urls?.[0] ? (
                    <img src={mediaUrl(v.image_urls[0])} alt="" className="w-full h-32 object-cover" />
                  ) : (
                    <VehiclePlaceholder className="h-32" />
                  )}
                  <CardContent className="pt-3 pb-4">
                    <p className="font-semibold">{v.year && `${v.year} `}{v.make} {v.model}</p>
                    {v.engine && <p className="text-xs text-muted-foreground">{v.engine}</p>}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )
      ) : tab === "saved" ? (
        savedPosts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">{t("profile.noPosts")}</div>
        ) : (
          savedPosts.map((post: Post) => <PostCard key={post.id} post={post} />)
        )
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t("profile.noPosts")}</div>
      ) : (
        posts.map((post: Post) => <PostCard key={post.id} post={post} />)
      )}

      {selectedVehicle && (
        <VehicleDetailModal
          vehicle={selectedVehicle}
          onClose={() => setSelectedVehicle(null)}
          editable={isOwnProfile}
        />
      )}
    </div>
  );
}
