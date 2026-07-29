import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Heart, MapPin, MessageCircle, Share2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, Comment, Post } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface PostCardProps {
  post: Post;
}

function ImageCarousel({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0);
  if (!urls.length) return null;
  return (
    <div className="relative bg-black/20">
      <img src={mediaUrl(urls[idx])} alt="" className="w-full aspect-square object-cover" loading="lazy" />
      {urls.length > 1 && (
        <>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {urls.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn("w-1.5 h-1.5 rounded-full", i === idx ? "bg-white" : "bg-white/40")}
              />
            ))}
          </div>
          {idx > 0 && (
            <button onClick={() => setIdx(idx - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full text-white text-lg">‹</button>
          )}
          {idx < urls.length - 1 && (
            <button onClick={() => setIdx(idx + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full text-white text-lg">›</button>
          )}
        </>
      )}
    </div>
  );
}

export default function PostCard({ post }: PostCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const lastTap = useRef(0);

  const likePost = useMutation({
    mutationFn: () => api.toggleLike(post.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const savePost = useMutation({
    mutationFn: () => api.toggleSave(post.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!post.is_liked) likePost.mutate();
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 800);
    }
    lastTap.current = now;
  };

  const loadComments = async () => {
    if (showComments) { setShowComments(false); return; }
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
  };

  const images = post.image_urls || [];

  return (
    <article className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <Link to={`/profile/${post.author.id}`}>
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold overflow-hidden">
            {post.author.profile_picture_url ? (
              <img src={mediaUrl(post.author.profile_picture_url)} alt="" className="w-full h-full object-cover" />
            ) : (
              post.author.full_name[0]?.toUpperCase()
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/profile/${post.author.id}`} className="font-semibold hover:text-primary transition-colors">
            {post.author.full_name}
            {post.author.is_verified && <span className="text-primary mr-1">✓</span>}
          </Link>
          <p className="text-xs text-muted-foreground">@{post.author.username}</p>
        </div>
      </div>

      <div className="relative" onClick={handleDoubleTap}>
        {images.length > 0 ? (
          <ImageCarousel urls={images} />
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

      {post.location && (
        <p className="px-4 pt-2 text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {post.location}
        </p>
      )}

      <div className="flex items-center gap-4 px-4 py-3">
        <button
          onClick={() => likePost.mutate()}
          className={cn("flex items-center gap-1.5 text-sm transition-colors", post.is_liked ? "text-primary" : "text-muted-foreground hover:text-primary")}
        >
          <Heart className={cn("w-5 h-5", post.is_liked && "fill-current")} />
          {post.likes_count}
        </button>
        <button onClick={loadComments} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <MessageCircle className="w-5 h-5" />
          {post.comments_count}
        </button>
        <button
          onClick={() => savePost.mutate()}
          className={cn("flex items-center gap-1.5 text-sm transition-colors mr-auto", post.is_saved ? "text-primary" : "text-muted-foreground hover:text-primary")}
        >
          <Bookmark className={cn("w-5 h-5", post.is_saved && "fill-current")} />
        </button>
        <button onClick={() => { navigator.clipboard.writeText(window.location.origin); toast.success(t("linkCopied")); }} className="text-muted-foreground hover:text-primary">
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
                <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {c.author.full_name[0]}
                </div>
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
  );
}
