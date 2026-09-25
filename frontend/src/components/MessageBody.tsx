import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { mediaUrl } from "@/lib/media";

const URL_RE = /https?:\/\/[^\s]+/gi;

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

export function firstPostUrl(content: string): string | null {
  for (const part of messageParts(content)) {
    if (part.type === "link" && postIdFromUrl(part.value)) return part.value;
  }
  return null;
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

export function SharedPostPreview({ href }: { href: string }) {
  const { t } = useTranslation();
  const postId = postIdFromUrl(href);
  const { data, isError, isLoading } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => api.getPost(postId!),
    enabled: Boolean(postId),
    retry: false,
  });

  if (!postId) return null;
  if (isLoading) return null;
  if (isError || !data) {
    return <p className="text-xs mt-2 opacity-80">{t("messagePostUnavailable")}</p>;
  }

  const image = data.image_urls?.[0];
  return (
    <Link to={`/posts/${data.id}`} className="mt-2 block rounded-xl overflow-hidden border border-current/15 bg-background/80 text-foreground">
      {image ? <img src={mediaUrl(image)} alt="" className="w-full h-24 object-cover" /> : null}
      <span className="block px-2.5 py-2">
        <span className="block text-xs font-medium truncate">{data.author.full_name}</span>
        {data.content ? <span className="block text-xs text-muted-foreground line-clamp-2">{data.content}</span> : null}
      </span>
    </Link>
  );
}
