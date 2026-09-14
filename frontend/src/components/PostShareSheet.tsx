import { useTranslation } from "react-i18next";
import ShareSheet from "@/components/ShareSheet";
import { Post } from "@/lib/api";

interface PostShareSheetProps {
  post: Post;
  open: boolean;
  onClose: () => void;
}

function postUrl(postId: string) {
  return `${window.location.origin}/posts/${postId}`;
}

function shareText(post: Post, t: (key: string) => string) {
  const author = post.author.full_name;
  const snippet = post.content?.slice(0, 120) ?? "";
  return snippet
    ? t("sharePostMessageWithContent").replace("{author}", author).replace("{content}", snippet)
    : t("sharePostMessage").replace("{author}", author);
}

export default function PostShareSheet({ post, open, onClose }: PostShareSheetProps) {
  const { t } = useTranslation();
  return (
    <ShareSheet
      open={open}
      onClose={onClose}
      heading={t("sharePost")}
      url={postUrl(post.id)}
      text={shareText(post, t)}
    />
  );
}
