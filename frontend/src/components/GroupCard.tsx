import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { avatarColors, avatarInitial } from "@/lib/avatar";
import type { Group } from "@/lib/api";
import { cn } from "@/lib/utils";

export function GroupMark({
  id,
  name,
  size = "md",
  className,
}: {
  id: string;
  name: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const colors = avatarColors(id);
  const initial = avatarInitial(name);
  return (
    <div
      className={cn(
        "rounded-2xl flex items-center justify-center font-bold shrink-0",
        size === "lg" ? "w-20 h-20 sm:w-24 sm:h-24 text-3xl" : "w-12 h-12 text-lg",
        className,
      )}
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {initial}
    </div>
  );
}

export default function GroupCard({ group }: { group: Group }) {
  const { t } = useTranslation();
  const isPrivate = group.privacy === "closed";

  return (
    <Link to={`/groups/${group.id}`} className="block h-full">
      <Card className="h-full hover:border-primary/30 transition-colors">
        <CardContent className="pt-5 pb-5 flex gap-3">
          <GroupMark id={group.id} name={group.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold truncate">{group.name}</h3>
              {isPrivate && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                  {t("groupPrivacyPrivate")}
                </span>
              )}
            </div>
            {group.my_status === "pending" && (
              <p className="text-xs text-amber-600 mt-0.5">{t("groupJoinPending")}</p>
            )}
            {group.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{group.description}</p>
            )}
            {group.category && t(`groupCategories.${group.category.toLowerCase()}`, { defaultValue: "" }) ? (
              <p className="text-xs text-primary mt-1">
                {t(`groupCategories.${group.category.toLowerCase()}`)}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {t("membersCount", { count: group.members_count })}
              {group.is_member && (
                <>
                  <span aria-hidden>·</span>
                  {t("groupMember")}
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
