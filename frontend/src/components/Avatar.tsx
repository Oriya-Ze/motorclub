import { cn } from "@/lib/utils";
import { avatarColors, avatarInitial } from "@/lib/avatar";
import { mediaUrl } from "@/lib/media";

type AvatarUser = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  profile_picture_url?: string | null;
};

const SIZES = {
  xs: "w-7 h-7 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-xl",
  "2xl": "w-24 h-24 text-3xl",
} as const;

interface AvatarProps {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
}

export default function Avatar({ user, size = "md", className }: AvatarProps) {
  const seed = user.id ?? user.email ?? user.full_name ?? "user";
  const colors = avatarColors(seed);
  const initial = avatarInitial(user.full_name ?? user.email);

  if (user.profile_picture_url) {
    return (
      <div className={cn("rounded-full overflow-hidden shrink-0 bg-muted", SIZES[size], className)}>
        <img src={mediaUrl(user.profile_picture_url)} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold shrink-0", SIZES[size], className)}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {initial}
    </div>
  );
}
