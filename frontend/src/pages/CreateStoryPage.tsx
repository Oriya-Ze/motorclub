import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

export default function CreateStoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading(true);
    try {
      const result = await api.uploadFile(files[0]);
      await api.createStory({ media_url: result.url, media_type: result.type === "video" ? "video" : "image" });
      toast.success(t("storyCreated"));
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 text-center space-y-6">
      <h1 className="text-2xl font-bold">{t("createStory")}</h1>
      <p className="text-muted-foreground text-sm">{t("storyDesc")}</p>
      <label className="block">
        <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFile(e.target.files)} disabled={uploading} />
        <Button disabled={uploading} className="cursor-pointer">
          {uploading ? "..." : t("uploadStory")}
        </Button>
      </label>
    </div>
  );
}
