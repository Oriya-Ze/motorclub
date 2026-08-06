import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

export default function CreateStoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setUploading(true);
    try {
      const result = await api.uploadMedia(files[0], "story");
      // TODO(orphan-cleanup): If createStory fails after a successful upload, the
      // storage object remains unreferenced until a future cleanup worker removes it.
      await api.createStory({
        media_url: result.reference,
        media_type: result.mediaType,
      });
      toast.success(t("storyCreated"));
      navigate("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 text-center space-y-6">
      <h1 className="text-2xl font-bold">{t("createStory")}</h1>
      <p className="text-muted-foreground text-sm">{t("storyDesc")}</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
        disabled={uploading}
      />
      <Button
        type="button"
        disabled={uploading}
        className="cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? "..." : t("uploadStory")}
      </Button>
    </div>
  );
}
