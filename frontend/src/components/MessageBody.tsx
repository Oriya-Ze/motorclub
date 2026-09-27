import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Avatar from "@/components/Avatar";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";
import { pickStoredImageUrl } from "@/lib/postMedia";

const URL_RE = /https?:\/\/[^\s]+/gi;
const SHARE_LINE = /^(ראה\/י את הפוסט של .+|check out .+post.*)$/i;

function trimUrl(raw: string) {
  return raw.replace(/[),.;!?]+$/g, "");
}

export function messageParts(content: string): Array<{ type: "text" | "link"; value: string }> {
  const parts: Array<{ type: "text" | "link"; value: string }> = [];
  let last = 0;
  for (const match of content.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const raw = match[0];
    const href = trimUrl(raw);
    if (start > last) parts.push({ type: "text", value: content.slice(last, start) });
    parts.push({ type: "link", value: href });
    last = start + raw.length;
    if (raw.length !== href.length) parts.push({ type: "text", value: raw.slice(href.length) });
  }
  if (last < content.length) parts.push({ type: "text", value: content.slice(last) });
  return parts.length ? parts : [{ type: "text", value: content }];
}

export function postIdFromUrl(href: string): string | null {
  try {
    const url = new URL(href);
    const match = url.pathname.match(/^\/posts\/([0-9a-f-]{36})$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function firstPostUrl(content: string): string | null {
  for (const part of messageParts(content)) {
    if (part.type === "link" && postIdFromUrl(part.value)) return part.value;
  }
  return null;
}

export function messageWithoutShareChrome(content: string): string {
  const postUrl = /https?:\/\/[^\s]+/gi;
  return content
    .split("\n")
    .map((line) => line.replace(postUrl, (raw) => (postIdFromUrl(trimUrl(raw)) ? "" : raw)).trim())
    .filter((line) => line && !SHARE_LINE.test(line))
    .join("\n")
    .trim();
}

export function MessageText({ content, mine }: { content: string; mine?: boolean }) {
  const linkClass = mine ? "underline break-all" : "text-primary underline break-all";
  return (
    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
      {messageParts(content).map((part, index) =>
        part.type === "link" ? (
          <a key={index} href={part.value} className={linkClass}>
            <bdi>{part.value}</bdi>
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </p>
  );
}

export function SharedPostPreview({ href, onOpen }: { href: string; onOpen?: () => void }) {
  const { t } = useTranslation();
  const postId = postIdFromUrl(href);
  const { data, isError, isLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => api.getPost(postId!),
    enabled: Boolean(postId),
    retry: false,
  });

  if (!postId) return null;
  if (isLoading) {
    return <div className="h-24 w-full rounded-2xl bg-muted/70 animate-pulse" aria-hidden />;
  }
  if (isError || !data) {
    return (
      <div className="w-full rounded-2xl border border-border/70 bg-card px-3 py-3 text-sm text-foreground">
        {t("messagePostUnavailable")}
      </div>
    );
  }

  const imageKey = data.image_urls?.[0]
    ? pickStoredImageUrl(data.image_urls[0], data.image_media, "detail")
    : "";
  const video = data.video_media?.find((item) => item.source_key === data.video_urls?.[0]);
  const thumb = imageKey || video?.poster_key || video?.thumb_key || "";

  return (
    <Link
      to={`/posts/${data.id}`}
      onClick={onOpen}
      className="block w-full overflow-hidden rounded-2xl border border-border/70 border-s-2 border-s-primary bg-card text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-2 px-3 pt-3">
        <Avatar user={data.author} size="xs" />
        <span className="min-w-0 text-sm font-medium truncate">{data.author.full_name}</span>
      </span>
      {data.content ? (
        <span className="block px-3 pt-1.5 text-sm text-foreground/85 leading-snug line-clamp-2">{data.content}</span>
      ) : null}
      {thumb ? (
        <img src={mediaUrl(thumb)} alt="" className="mt-2 w-full max-h-64 object-contain bg-muted" />
      ) : (
        <span className="block h-2" />
      )}
    </Link>
  );
}
