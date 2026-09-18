import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

type Props = {
  userId: string;
  size?: "default" | "sm";
};

export default function FollowButton({ userId, size = "sm" }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: followStatus } = useQuery({
    queryKey: ["follow-status", userId],
    queryFn: () => api.getFollowStatus(userId),
    enabled: Boolean(userId),
  });

  const followMutation = useMutation({
    mutationFn: () => api.followUser(userId),
    onSuccess: (data) => {
      queryClient.setQueryData(["follow-status", userId], {
        following: data.following,
        status: data.status === "cancelled" ? "none" : data.status,
      });
      queryClient.invalidateQueries({ queryKey: ["followers-count", userId] });
      queryClient.invalidateQueries({ queryKey: ["followers"] });
      queryClient.invalidateQueries({ queryKey: ["following"] });
      queryClient.invalidateQueries({ queryKey: ["follow-requests"] });
      if (data.status === "pending") toast.success(t("profile.followRequested"));
      else if (data.status === "cancelled") toast.success(t("profile.followRequestCancelled"));
      else if (data.following) toast.success(t("profile.followSuccess"));
      else toast.success(t("profile.unfollowSuccess"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const status = followStatus?.status === "cancelled" ? "none" : followStatus?.status;
  const following = followStatus?.following || status === "accepted";
  const pending = status === "pending";

  return (
    <Button
      size={size}
      variant={following || pending ? "outline" : "default"}
      disabled={followMutation.isPending}
      onClick={() => followMutation.mutate()}
    >
      {following ? t("profile.unfollow") : pending ? t("profile.cancelFollowRequest") : t("profile.follow")}
    </Button>
  );
}
