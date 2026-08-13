import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ImageCropModal from "@/components/ImageCropModal";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { isImageFile } from "@/lib/cropImage";

export default function CreateStoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const publishStory = async (file: File, mediaType: "image" | "video") => {
    setUploading(true);
    try {
      const result = await api.uploadMedia(file, "story");
      await api.createStory({
        media_url: result.reference,
        media_type: mediaType,
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

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    if (file.type.startsWith("video/")) {
      await publishStory(file, "video");
      return;
    }

    if (isImageFile(file)) {
      setCropFile(file);
      return;
    }

    toast.error(t("error"));
  };

  const handleCroppedImage = async (cropped: File) => {
    setCropFile(null);
    await publishStory(cropped, "image");
  };

  return (
    <>
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          purpose="story"
          onConfirm={handleCroppedImage}
          onCancel={() => {
            setCropFile(null);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      )}
      <div className="max-w-md mx-auto py-12 text-center space-y-6">
        <h1 className="text-2xl font-bold">{t("createStory")}</h1>
        <p className="text-muted-foreground text-sm">{t("storyDesc")}</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
          disabled={uploading || !!cropFile}
        />
        <Button
          type="button"
          disabled={uploading || !!cropFile}
          className="cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "..." : t("uploadStory")}
        </Button>
      </div>
    </>
  );
}
