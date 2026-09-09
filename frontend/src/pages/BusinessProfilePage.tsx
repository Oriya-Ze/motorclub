import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Clock,
  MessageCircle,
  Phone,
  Share2,
  Star,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import VerifiedBadge from "@/components/VerifiedBadge";
import { useMessagesPanelOptional } from "@/components/MessagesPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ProfileSkeleton, PostSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  DAY_KEYS,
  getBusinessListPath,
  mapsEmbedUrl,
  mapsUrl,
  whatsappUrl,
} from "@/lib/businessProfile";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type Tab = "posts" | "services" | "reviews";

function StarRating({ value, onChange, readonly }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          className={cn("transition-colors", readonly ? "cursor-default" : "hover:scale-110")}
        >
          <Star
            className={cn("w-5 h-5", star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
          />
        </button>
      ))}
    </div>
  );
}

function ActionIcon({
  href,
  onClick,
  label,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const cls = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/80",
    "text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors",
    className,
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} aria-label={label} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {children}
    </button>
  );
}

export default function BusinessProfilePage() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const { user: authUser } = useAuth();
  const messagesPanel = useMessagesPanelOptional();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("posts");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewFormReady, setReviewFormReady] = useState(false);

  const { data: business, isLoading, error } = useQuery({
    queryKey: ["business", userId],
    queryFn: () => api.getBusiness(userId!),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (userId && business && authUser?.id !== userId) {
      void api.recordBusinessEvent(userId, "view").catch(() => undefined);
    }
  }, [userId, business?.id, authUser?.id]);

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["business-services", userId],
    queryFn: () => api.getBusinessServices(userId!),
    enabled: Boolean(userId) && tab === "services",
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["user-posts", userId],
    queryFn: () => api.getPosts({ userId: userId! }),
    enabled: Boolean(userId) && tab === "posts",
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["business-reviews", userId],
    queryFn: () => api.getBusinessReviews(userId!),
    enabled: Boolean(userId),
  });

  const myReview = useMemo(() => {
    if (!authUser) return null;
    return reviews.find((review) => review.reviewer?.id === authUser.id) ?? null;
  }, [authUser, reviews]);

  useEffect(() => {
    setReviewFormReady(false);
    setReviewRating(5);
    setReviewText("");
  }, [userId]);

  useEffect(() => {
    if (reviewFormReady || reviewsLoading || !authUser) return;
    if (myReview) {
      setReviewRating(myReview.rating);
      setReviewText(myReview.text ?? "");
    }
    setReviewFormReady(true);
  }, [authUser, myReview, reviewFormReady, reviewsLoading]);

  const { data: followStatus } = useQuery({
    queryKey: ["follow-status", userId],
    queryFn: () => api.getFollowStatus(userId!),
    enabled: Boolean(userId && authUser && userId !== authUser.id),
  });

  const followMutation = useMutation({
    mutationFn: () => api.followUser(userId!),
    onSuccess: (data) => {
      queryClient.setQueryData(["follow-status", userId], data);
      toast.success(data.following ? t("profile.followSuccess") : t("profile.unfollowSuccess"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const messageMutation = useMutation({
    mutationFn: () => api.startConversation(userId!),
    onSuccess: (conv) => messagesPanel?.openMessages(conv.id),
    onError: (err: Error) => toast.error(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: () => api.createBusinessReview(userId!, { rating: reviewRating, text: reviewText.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-reviews", userId] });
      queryClient.invalidateQueries({ queryKey: ["business", userId] });
      toast.success(t("businessProfile.reviewSaved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const trackEvent = (eventType: string) => {
    if (!userId || authUser?.id === userId) return;
    void api.recordBusinessEvent(userId, eventType).catch(() => undefined);
  };

  const handleShare = async () => {
    trackEvent("share_click");
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: business?.full_name, url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success(t("businessProfile.linkCopied"));
  };

  const specializations = useMemo(() => {
    if (!business) return [];
    const items: string[] = [];
    if (business.business_type) {
      items.push(t(`businessCategories.${business.business_type}`, { defaultValue: business.business_type }));
    }
    for (const cert of business.certifications ?? []) {
      const trimmed = cert.trim();
      if (trimmed && !items.includes(trimmed)) items.push(trimmed);
    }
    return items;
  }, [business, t]);

  const displayRating = useMemo(() => {
    if (!business) return null;
    const avg = business.rating_avg;
    if (avg != null && !Number.isNaN(Number(avg))) {
      return Number(avg).toFixed(1);
    }
    if (reviews.length > 0) {
      const computed = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
      return computed.toFixed(1);
    }
    return null;
  }, [business, reviews]);

  if (isLoading) return <ProfileSkeleton />;
  if (error || !business) {
    const backPath = getBusinessListPath();
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-muted-foreground">{t("businessProfile.notFound")}</p>
        <Link to={backPath}>
          <Button variant="outline" size="sm">{t("businessProfile.backToList")}</Button>
        </Link>
      </div>
    );
  }

  const isOwn = authUser?.id === business.id;
  const listPath = getBusinessListPath(business.business_type);
  const reviewCount = business.review_count ?? reviews.length;
  const canReview = Boolean(authUser && !isOwn);

  const openReviewsTab = () => setTab("reviews");

  const tabs: { id: Tab; label: string }[] = [
    { id: "posts", label: t("workshops.posts") },
    { id: "services", label: t("businessProfile.services") },
    { id: "reviews", label: t("businessProfile.reviews") },
  ];

  const loading = tab === "posts" ? postsLoading : tab === "services" ? servicesLoading : reviewsLoading;

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-20 md:pb-8">
      <Link
        to={listPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        {t("businessProfile.backToList")}
      </Link>

      <Card className="overflow-hidden shadow-glow border-border/60">
        {/* Cover */}
        <div className="relative h-36 sm:h-44 bg-gradient-to-l from-primary/30 via-primary/10 to-muted/30">
          {business.cover_image_url && (
            <img
              src={mediaUrl(business.cover_image_url)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
        </div>

        <CardContent className="relative pt-0 pb-6 px-4 sm:px-6 space-y-5">
          {/* Avatar + name row (mirrors naturally in RTL/LTR) */}
          <div className="flex items-end gap-3 sm:gap-5 -mt-12 sm:-mt-14">
            <Avatar
              user={{
                id: business.id,
                full_name: business.full_name,
                profile_picture_url: business.profile_picture_url,
              }}
              size="2xl"
              className="relative z-10 shrink-0 border-4 border-card ring-2 ring-primary/15 bg-card shadow-md"
            />

            <div className="flex-1 min-w-0 pb-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-display tracking-wide leading-tight truncate">
                  {business.full_name}
                </h1>
                {business.is_verified && <VerifiedBadge className="w-5 h-5 shrink-0 text-primary" />}
                {business.is_open_now != null && (
                  <span
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0",
                      business.is_open_now ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {business.is_open_now ? t("businessProfile.openNow") : t("businessProfile.closedNow")}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={canReview ? openReviewsTab : undefined}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-sm font-semibold text-amber-600 dark:text-amber-400",
                    canReview && "hover:bg-amber-400/20 transition-colors cursor-pointer",
                  )}
                  aria-label={displayRating ? t("businessProfile.ratingLabel", { rating: displayRating }) : t("businessProfile.noRatingYet")}
                >
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                  {displayRating ?? "—"}
                  {reviewCount > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">({reviewCount})</span>
                  )}
                </button>
                {canReview && (
                  <Button size="sm" variant="outline" className="h-9 rounded-full px-3" onClick={openReviewsTab}>
                    {myReview ? t("businessProfile.editReview") : t("businessProfile.rateBusiness")}
                  </Button>
                )}
                {business.business_phone && (
                  <ActionIcon
                    href={`tel:${business.business_phone}`}
                    onClick={() => trackEvent("call_click")}
                    label={t("workshops.call")}
                  >
                    <Phone className="w-4 h-4" />
                  </ActionIcon>
                )}
                {business.business_phone && (
                  <ActionIcon
                    href={whatsappUrl(business.business_phone)}
                    onClick={() => trackEvent("whatsapp_click")}
                    label="WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </ActionIcon>
                )}
                <ActionIcon onClick={() => void handleShare()} label={t("businessProfile.share")}>
                  <Share2 className="w-4 h-4" />
                </ActionIcon>
              </div>
            </div>
          </div>

          {!isOwn && authUser && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={followStatus?.following ? "outline" : "default"}
                disabled={followMutation.isPending}
                onClick={() => followMutation.mutate()}
              >
                {followStatus?.following ? t("profile.unfollow") : t("profile.follow")}
              </Button>
              <Button size="sm" variant="outline" disabled={messageMutation.isPending} onClick={() => messageMutation.mutate()}>
                {t("workshops.message")}
              </Button>
            </div>
          )}

          {business.business_description && (
            <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {business.business_description}
            </p>
          )}

          {specializations.length > 0 && (
            <div className="space-y-2.5">
              <h2 className="text-sm font-semibold">{t("businessProfile.specializations")}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {specializations.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(business.business_hours && Object.keys(business.business_hours).length > 0) || business.business_address ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {business.business_hours && Object.keys(business.business_hours).length > 0 && (
                <div className="rounded-2xl border border-border/50 bg-muted/30 p-4 space-y-2.5">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    {t("businessProfile.hours")}
                  </h2>
                  <div className="space-y-1.5 text-sm">
                    {DAY_KEYS.map((key) => {
                      const day = business.business_hours?.[key];
                      if (!day) return null;
                      return (
                        <div key={key} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{t(`businessProfile.days.${key}`)}</span>
                          <span dir="ltr" className="font-medium">
                            {day.closed ? t("businessProfile.closed") : `${day.open ?? "—"} – ${day.close ?? "—"}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {business.business_address && (
                <a
                  href={mapsUrl(business.business_address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("navigate_click")}
                  className="group relative block min-h-[11rem] rounded-2xl overflow-hidden border border-border/50"
                  aria-label={t("businessProfile.navigate")}
                >
                  <iframe
                    title={t("businessProfile.map")}
                    src={mapsEmbedUrl(business.business_address)}
                    className="absolute inset-0 w-full h-full border-0 pointer-events-none scale-[1.02]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-black/10 transition-colors group-hover:from-black/65" />
                  <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm sm:text-base font-semibold text-white/90 leading-snug pointer-events-none select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                    {business.business_address}
                  </p>
                </a>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="sticky top-0 z-20 -mx-1 px-1 bg-background/90 backdrop-blur-md border-b border-border/50">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="space-y-4">
          <PostSkeleton />
          <PostSkeleton />
        </div>
      ) : tab === "posts" ? (
        posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-2xl border border-dashed border-border/60">
            {t("workshops.noPosts")}
          </div>
        ) : (
          <div className="space-y-4">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
        )
      ) : tab === "services" ? (
        services.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground rounded-2xl border border-dashed border-border/60">
            {t("businessProfile.noServices")}
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <Card key={service.id} className="border-border/60">
                <CardContent className="pt-4 pb-4 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Wrench className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{service.name}</h3>
                    {service.description && <p className="text-sm text-muted-foreground mt-1">{service.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-primary font-medium">
                      {service.price_from != null && <span>₪{service.price_from.toLocaleString()}+</span>}
                      {service.duration_minutes != null && (
                        <span>{t("businessProfile.durationMinutes", { count: service.duration_minutes })}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-4">
          {canReview && (
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4 space-y-3">
                <h3 className="font-semibold">
                  {myReview ? t("businessProfile.yourReview") : t("businessProfile.writeReview")}
                </h3>
                <StarRating value={reviewRating} onChange={setReviewRating} />
                <Input
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder={t("businessProfile.reviewPlaceholder")}
                />
                <Button size="sm" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>
                  {myReview ? t("businessProfile.updateReview") : t("businessProfile.submitReview")}
                </Button>
              </CardContent>
            </Card>
          )}
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground rounded-2xl border border-dashed border-border/60">
              {t("businessProfile.noReviews")}
            </div>
          ) : (
            reviews.map((review) => (
              <Card key={review.id} className="border-border/60">
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar
                      user={{
                        id: review.reviewer?.id ?? review.id,
                        full_name: review.reviewer?.full_name ?? "?",
                        profile_picture_url: review.reviewer?.profile_picture_url,
                      }}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium text-sm">{review.reviewer?.full_name}</p>
                      <StarRating value={review.rating} readonly />
                    </div>
                  </div>
                  {review.text && <p className="text-sm text-muted-foreground">{review.text}</p>}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
