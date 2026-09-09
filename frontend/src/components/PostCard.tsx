import { memo, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart, MapPin, MessageCircle, MoreHorizontal, Share2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Avatar from "@/components/Avatar";
import PostMediaCarousel from "@/components/PostMediaCarousel";
import PostShareSheet from "@/components/PostShareSheet";
import VehicleBadge from "@/components/VehicleBadge";
import VerifiedBadge from "@/components/VerifiedBadge";
import { api, Comment, Post } from "@/lib/api";
import { cn, displayName, formatHandle, formatRelativeTime } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";

interface PostCardProps {
  post: Post;
  onDeleted?: () => void;
  variant?: "feed" | "detail";
}

function PostCard({ post, onDeleted, variant = "feed" }: PostCardProps) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDetail = variant === "detail";
  const [showComments, setShowComments] = useState(isDetail);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const lastTap = useRef(0);
  const openPostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthor = user?.id === post.user_id;

  useEffect(() => {
    if (!isDetail) return;
    setShowComments(true);
    setLoadingComments(true);
    api.getComments(post.id)
      .then(setComments)
      .finally(() => setLoadingComments(false));
  }, [isDetail, post.id]);

  useEffect(() => {
    return () => {
      if (openPostTimer.current) clearTimeout(openPostTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMenu]);

  const likePost = useMutation({
    mutationFn: () => api.toggleLike(post.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
    },
  });

  const savePost = useMutation({
    mutationFn: () => api.toggleSave(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", post.id] });
    },
  });

  const deletePost = useMutation({
    mutationFn: () => api.deletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.removeQueries({ queryKey: ["post", post.id] });
      toast.success(t("postDeleted"));
      onDeleted?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const triggerLikeAnimation = () => {
    if (!post.is_liked) likePost.mutate();
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 800);
  };

  const handleMediaInteract = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (openPostTimer.current) {
        clearTimeout(openPostTimer.current);
        openPostTimer.current = null;
      }
      triggerLikeAnimation();
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    if (!isDetail) {
      openPostTimer.current = setTimeout(() => {
        navigate(`/posts/${post.id}`);
      }, 280);
    }
  };

  const loadComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setLoadingComments(true);
    try {
      const data = await api.getComments(post.id);
      setComments(data);
      setShowComments(true);
    } finally {
      setLoadingComments(false);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    await api.createComment(post.id, comment.trim());
    setComment("");
    const data = await api.getComments(post.id);
    setComments(data);
    queryClient.invalidateQueries({ queryKey: ["posts"] });
    queryClient.invalidateQueries({ queryKey: ["post", post.id] });
  };

  const images = post.image_urls || [];

  return (
    <>
      <article className={cn("feed-post", isDetail ? "feed-post--detail" : "feed-post--feed")}>
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to={`/profile/${post.author.id}`}>
            <Avatar user={post.author} size="md" />
          </Link>
          <div className="flex-1 min-w-0">
            <Link to={`/profile/${post.author.id}`} className="font-semibold hover:text-primary transition-colors inline-flex items-center gap-1">
              {displayName(post.author)}
              {post.author.is_verified && <VerifiedBadge />}
            </Link>
            <p className="text-xs text-muted-foreground">{formatHandle(post.author)}</p>
            <p className="text-[11px] text-muted-foreground/80">{formatRelativeTime(post.created_at, i18n.language)}</p>
            {post.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" /> {post.location}
              </p>
            )}
            {post.vehicle_id && (
              <VehicleBadge
                label={t("linkedVehicle")}
                vehicleId={post.vehicle_id}
                className="mt-1.5"
              />
            )}
          </div>
          {isAuthor && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu((v) => !v)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50"
                aria-label={t("postOptions")}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute end-0 top-full mt-1 z-20 min-w-[160px] glass-card rounded-xl py-1">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-muted/50"
                    onClick={() => {
                      setShowMenu(false);
                      if (window.confirm(t("confirmDeletePost"))) deletePost.mutate();
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("deletePost")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={cn("relative", post.vehicle_id && images.length > 0 && "ring-2 ring-[#F5D033]/50 ring-inset")}>
          {images.length > 0 ? (
            <PostMediaCarousel
              urls={images}
              mode={isDetail ? "detail" : "feed"}
              onInteract={handleMediaInteract}
            />
          ) : post.content ? (
            <div className="px-4 pb-2 min-h-[60px]">
              <p className="whitespace-pre-wrap">{post.content}</p>
            </div>
          ) : null}
          {likeAnim && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Heart className="w-20 h-20 text-white fill-primary drop-shadow-lg animate-ping" />
            </div>
          )}
        </div>

        {images.length > 0 && post.content && (
          <div className="px-4 pt-3">
            <p className="whitespace-pre-wrap text-sm">{post.content}</p>
          </div>
        )}

        {post.hashtags && post.hashtags.length > 0 && (
          <div className="px-4 pt-2 flex flex-wrap gap-2">
            {post.hashtags.map((tag) => (
              <Link key={tag} to={`/explore?tag=${tag}`} className="text-sm text-primary hover:underline">
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => likePost.mutate()}
            className={cn("flex items-center gap-1.5 text-sm transition-colors", post.is_liked ? "text-primary" : "text-muted-foreground hover:text-primary")}
          >
            <Heart className={cn("w-5 h-5", post.is_liked && "fill-current")} />
            {post.likes_count}
          </button>
          <button
            onClick={loadComments}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            {post.comments_count}
          </button>
          <button
            onClick={() => savePost.mutate()}
            className={cn("flex items-center gap-1.5 text-sm transition-colors ms-auto", post.is_saved ? "text-primary" : "text-muted-foreground hover:text-primary")}
          >
            <Bookmark className={cn("w-5 h-5", post.is_saved && "fill-current")} />
          </button>
          <button onClick={() => setShowShare(true)} className="text-muted-foreground hover:text-primary">
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {showComments && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
            {loadingComments ? (
              <p className="text-sm text-muted-foreground">...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noComments")}</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar user={c.author} size="xs" />
                  <div className="flex-1 bg-muted/50 rounded-xl px-3 py-2">
                    <p className="text-xs font-medium">{c.author.full_name}</p>
                    <p className="text-sm">{c.content}</p>
                  </div>
                </div>
              ))
            )}
            <form onSubmit={submitComment} className="flex gap-2">
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("writeComment")} className="h-9 text-sm" />
              <Button type="submit" size="sm" disabled={!comment.trim()}>{t("publish")}</Button>
            </form>
          </div>
        )}
      </article>

      <PostShareSheet post={post} open={showShare} onClose={() => setShowShare(false)} />
    </>
  );
}

export default memo(PostCard);
