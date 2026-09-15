import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, PenLine, Share2, Star, Trash2, Wrench } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import PostCard from "@/components/PostCard";
import ShareSheet from "@/components/ShareSheet";
import VehicleImageCarousel from "@/components/VehicleImageCarousel";
import VehiclePhotoEditor from "@/components/VehiclePhotoEditor";
import { ProfileSkeleton, PostSkeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/contexts/AuthContext";
import { api, Vehicle } from "@/lib/api";
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
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showShare, setShowShare] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Vehicle>>({});

  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => api.getVehicle(vehicleId!),
    enabled: Boolean(vehicleId),
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["vehicle-posts", vehicleId],
    queryFn: () => api.getVehiclePosts(vehicleId!),
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
    onSuccess: (updated) => {
      queryClient.setQueryData(["vehicle", vehicleId], { ...vehicle, ...updated });
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      toast.success(t("garage.primarySet"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveEdit = useMutation({
    mutationFn: () =>
      api.updateVehicle(vehicleId!, {
        make: draft.make,
        model: draft.model,
        year: draft.year ? Number(draft.year) : null,
        trim: draft.trim || null,
        color: draft.color || null,
        engine: draft.engine || null,
        description: draft.description || null,
        mods: draft.mods || null,
        image_urls: draft.image_urls ?? [],
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["vehicle", vehicleId], { ...vehicle, ...updated, owner: vehicle?.owner });
      queryClient.invalidateQueries({ queryKey: ["garage"] });
      setEditing(false);
      toast.success(t("garage.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <ProfileSkeleton />;
  if (error || !vehicle) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">{t("garage.notFound")}</p>
        {!user && (
          <Link to="/auth" className="text-sm text-primary hover:underline">
            {t("login")}
          </Link>
        )}
      </div>
    );
  }

  const isOwner = user?.id === vehicle.user_id;
  const owner = vehicle.owner;
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const photoCount = vehicle.image_urls?.length ?? 0;
  const vehicleUrl = `${window.location.origin}/vehicles/${vehicle.id}`;
  const ownerPath = owner ? `/profile/${owner.id}` : "/";

  const startEdit = () => {
    setDraft({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year ?? undefined,
      trim: vehicle.trim ?? "",
      color: vehicle.color ?? "",
      engine: vehicle.engine ?? "",
      description: vehicle.description ?? "",
      mods: vehicle.mods ?? "",
      image_urls: vehicle.image_urls ?? [],
    });
    setEditing(true);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 md:pb-6">
      <Link to={isOwner ? "/garage" : ownerPath} className="inline-flex text-sm text-muted-foreground hover:text-primary">
        {isOwner ? t("garage.title") : t("garage.ownerProfile")}
      </Link>

      <Card className="overflow-hidden">
        {!editing && (
          <VehicleImageCarousel
            urls={vehicle.image_urls ?? []}
            className="rounded-none"
            imageClassName="rounded-none h-56 sm:h-72"
            alt={title}
          />
        )}
        <CardContent className="pt-4 pb-5 space-y-4">
          {editing ? (
            <div className="space-y-3">
              <VehiclePhotoEditor
                urls={draft.image_urls ?? []}
                onChange={(image_urls) => setDraft({ ...draft, image_urls })}
                disabled={saveEdit.isPending}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input value={draft.make ?? ""} onChange={(e) => setDraft({ ...draft, make: e.target.value })} placeholder={t("garage.make")} />
                <Input value={draft.model ?? ""} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder={t("garage.model")} />
                <Input value={draft.year ? String(draft.year) : ""} onChange={(e) => setDraft({ ...draft, year: e.target.value ? Number(e.target.value) : undefined })} placeholder={t("garage.year")} dir="ltr" />
                <Input value={draft.trim ?? ""} onChange={(e) => setDraft({ ...draft, trim: e.target.value })} placeholder={t("garage.trim")} />
                <Input value={draft.color ?? ""} onChange={(e) => setDraft({ ...draft, color: e.target.value })} placeholder={t("garage.color")} />
                <Input value={draft.engine ?? ""} onChange={(e) => setDraft({ ...draft, engine: e.target.value })} placeholder={t("garage.engine")} />
              </div>
              <textarea
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder={t("garage.description")}
                rows={2}
                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm resize-none"
              />
              <textarea
                value={draft.mods ?? ""}
                onChange={(e) => setDraft({ ...draft, mods: e.target.value })}
                placeholder={t("garage.mods")}
                rows={2}
                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => saveEdit.mutate()} disabled={!draft.make || !draft.model || saveEdit.isPending}>
                  {t("garage.saveChanges")}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-display tracking-wide">{title}</h1>
                    {isOwner && vehicle.is_primary && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        <Star className="w-3 h-3 fill-primary" />
                        {t("garage.primaryMine")}
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
                  <Link to={user ? ownerPath : "/auth"} className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar user={owner} size="md" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{displayName(owner)}</p>
                      <p className="text-xs text-muted-foreground">{formatHandle(owner)}</p>
                    </div>
                  </Link>
                  {user && !isOwner && <FollowButton userId={owner.id} />}
                  {!user && (
                    <Link to="/auth">
                      <Button size="sm" variant="outline">{t("login")}</Button>
                    </Link>
                  )}
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
                    onClick={() =>
                      navigate(location.pathname, {
                        state: { openCreatePost: true, vehicleId: vehicle.id, returnTo: location.pathname },
                      })
                    }
                  >
                    <PenLine className="w-4 h-4 me-1" />
                    {t("garage.postAbout")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={startEdit}>
                    {t("garage.edit")}
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
            </>
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
