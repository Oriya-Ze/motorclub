import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type UserLike = {
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function displayUsername(user: UserLike): string {
  const username = user.username?.trim();
  if (username && !UUID_RE.test(username)) return username;

  const emailLocal = user.email?.split("@")[0]?.trim();
  if (emailLocal && !UUID_RE.test(emailLocal)) return emailLocal;

  const fullName = user.full_name?.trim();
  if (fullName && !UUID_RE.test(fullName)) {
    return fullName.replace(/\s+/g, "_").toLowerCase().slice(0, 50);
  }

  return username || emailLocal || "user";
}

export function displayName(user: UserLike): string {
  const fullName = user.full_name?.trim();
  if (fullName && !UUID_RE.test(fullName)) return fullName;
  return displayUsername(user);
}

export function formatHandle(user: UserLike): string {
  return `@${displayUsername(user)}`;
}

export function formatRelativeTime(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale === "he" ? "he" : "en", { numeric: "auto" });

  if (diffSec < 60) return rtf.format(0, "second");
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return rtf.format(-diffDay, "day");
  return new Date(iso).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    day: "numeric",
    month: "short",
    year: diffDay > 365 ? "numeric" : undefined,
  });
}
