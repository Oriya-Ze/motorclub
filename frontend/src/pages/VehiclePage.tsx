import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, PenLine, Share2, Star, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import PostCard from "@/components/PostCard";
import ShareSheet from "@/components/ShareSheet";
import VehicleImageCarousel from "@/components/VehicleImageCarousel";
import { ProfileSkeleton, PostSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { getBusinessProfilePath } from "@/lib/businessProfile";
import { displayName, formatHandle } from "@/lib/utils";

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/40">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium text-sm mt-0.5">{value}</dd>
    </div>
  );
}

export default function VehiclePage() {
  const { t } = useTranslation();
  const { vehicleId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showShare, setShowShare] = useState(false);

  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => api.getVehicle(vehicleId!),
    enabled: Boolean(vehicleId),
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["vehicle-posts", vehicleId],
    queryFn: () => api.getPosts({ vehicleId: vehicleId!, limit: 30 }),
    enabled: Boolean(vehicleId),
  });

  const deleteVehicle = useMutation({
    mutationFn: () => api.deleteVehicle(vehicleId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      toast.success(t("garage.deleted"));
      navigate("/garage");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setPrimary = useMutation({
    mutationFn: () => api.updateVehicle(vehicleId!, { is_primary: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      toast.success(t("garage.primarySet"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <ProfileSkeleton />;
  if (error || !vehicle) {
    return <div className="text-center py-12 text-muted-foreground">{t("garage.notFound")}</div>;
  }

  const isOwner = user?.id === vehicle.user_id;
  const owner = vehicle.owner;
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const photoCount = vehicle.image_urls?.length ?? 0;
  const vehicleUrl = `${window.location.origin}/vehicles/${vehicle.id}`;
  const ownerPath = owner
    ? owner.account_type === "business"
      ? getBusinessProfilePath(owner.business_type, owner.id)
      : `/profile/${owner.id}`
    : "/";

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 md:pb-6">
      <Link to={isOwner ? "/garage" : ownerPath} className="inline-flex text-sm text-muted-foreground hover:text-primary">
        {isOwner ? t("garage.title") : t("garage.ownerProfile")}
      </Link>

      <Card className="overflow-hidden">
        <VehicleImageCarousel
          urls={vehicle.image_urls ?? []}
          className="rounded-none"
          imageClassName="rounded-none h-56 sm:h-72"
        />
        <CardContent className="pt-4 pb-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-display tracking-wide">{title}</h1>
                {vehicle.is_primary && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    <Star className="w-3 h-3 fill-primary" />
                    {t("garage.primaryBadge")}
                  </span>
                )}
              </div>
              {vehicle.trim && <p className="text-sm text-muted-foreground mt-0.5">{vehicle.trim}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowShare(true)}>
              <Share2 className="w-4 h-4 me-1" />
              {t("shareVehicle")}
            </Button>
          </div>

          {owner && (
            <div className="flex items-center gap-3">
              <Link to={ownerPath} className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar user={owner} size="md" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{displayName(owner)}</p>
                  <p className="text-xs text-muted-foreground">{formatHandle(owner)}</p>
                </div>
              </Link>
              {!isOwner && <FollowButton userId={owner.id} />}
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            {photoCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                <Camera className="w-3.5 h-3.5" />
                {t("garage.photoCount", { count: photoCount })}
              </span>
            )}
            {vehicle.mods && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                <Wrench className="w-3.5 h-3.5" />
                {t("garage.hasMods")}
              </span>
            )}
          </div>

          {(vehicle.color || vehicle.engine || vehicle.year) && (
            <dl className="grid grid-cols-2 gap-2">
              {vehicle.year && <SpecItem label={t("garage.year")} value={String(vehicle.year)} />}
              {vehicle.color && <SpecItem label={t("garage.color")} value={vehicle.color} />}
              {vehicle.engine && <SpecItem label={t("garage.engine")} value={vehicle.engine} />}
            </dl>
          )}

          {vehicle.description && (
            <div>
              <h2 className="text-sm font-semibold mb-1">{t("garage.description")}</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{vehicle.description}</p>
            </div>
          )}

          {vehicle.mods && (
            <div>
              <h2 className="text-sm font-semibold mb-1">{t("garage.mods")}</h2>
              <p className="text-sm whitespace-pre-wrap">{vehicle.mods}</p>
            </div>
          )}

          {isOwner && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => navigate("/", { state: { openCreatePost: true, vehicleId: vehicle.id } })}
              >
                <PenLine className="w-4 h-4 me-1" />
                {t("garage.postAbout")}
              </Button>
              {!vehicle.is_primary && (
                <Button size="sm" variant="outline" onClick={() => setPrimary.mutate()} disabled={setPrimary.isPending}>
                  <Star className="w-4 h-4 me-1" />
                  {t("garage.setPrimary")}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  if (window.confirm(t("garage.delete"))) deleteVehicle.mutate();
                }}
                disabled={deleteVehicle.isPending}
              >
                <Trash2 className="w-4 h-4 me-1" />
                {t("garage.delete")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-3">{t("garage.linkedPosts")}</h2>
        {postsLoading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("garage.noPostsYet")}</p>
        ) : (
          <div className="space-y-0">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} variant="feed" />
            ))}
          </div>
        )}
      </div>

      <ShareSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        heading={t("shareVehicle")}
        url={vehicleUrl}
        text={t("shareVehicleMessage", { name: title })}
        sentToastKey="vehicleSharedToUser"
      />
    </div>
  );
}
