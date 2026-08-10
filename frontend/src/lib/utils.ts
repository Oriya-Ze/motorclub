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
