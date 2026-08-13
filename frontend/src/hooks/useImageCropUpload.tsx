import { useRef, useState } from "react";
import ImageCropModal from "@/components/ImageCropModal";
import { api } from "@/lib/api";
import { isImageFile } from "@/lib/cropImage";
import type { MediaPurpose, UploadMediaResult } from "@/lib/mediaUpload";
import { SUPPORTED_IMAGE_TYPES } from "@/lib/mediaUpload";

interface UseImageCropUploadOptions {
  purpose: MediaPurpose;
  multiple?: boolean;
  onUploaded: (result: UploadMediaResult) => void;
  onAllComplete?: () => void;
  onError?: (error: Error) => void;
}

function filterImageFiles(files: FileList | null): File[] {
  if (!files?.length) return [];
  return Array.from(files).filter(
    (f) => isImageFile(f) && SUPPORTED_IMAGE_TYPES.includes(f.type as (typeof SUPPORTED_IMAGE_TYPES)[number])
  );
}

export function useImageCropUpload({
  purpose,
  multiple = false,
  onUploaded,
  onAllComplete,
  onError,
}: UseImageCropUploadOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<File[]>([]);
  const [current, setCurrent] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSelect = (files: FileList | null) => {
    const images = filterImageFiles(files);
    if (!images.length) return;

    const batch = multiple ? images : [images[0]];
    setQueue(batch.slice(1));
    setCurrent(batch[0]);

    if (inputRef.current) inputRef.current.value = "";
  };

  const clearQueue = () => {
    setCurrent(null);
    setQueue([]);
  };

  const handleCropConfirm = async (cropped: File) => {
    setUploading(true);
    try {
      const result = await api.uploadMedia(cropped, purpose);
      onUploaded(result);

      if (queue.length > 0) {
        setCurrent(queue[0]);
        setQueue((prev) => prev.slice(1));
      } else {
        clearQueue();
        onAllComplete?.();
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error("Upload failed"));
      clearQueue();
    } finally {
      setUploading(false);
    }
  };

  const cropModal = current ? (
    <ImageCropModal
      key={`${current.name}-${current.lastModified}-${current.size}`}
      file={current}
      purpose={purpose}
      queueRemaining={queue.length}
      uploading={uploading}
      onConfirm={handleCropConfirm}
      onCancel={clearQueue}
    />
  ) : null;

  return {
    inputRef,
    handleSelect,
    cropModal,
    uploading: uploading || !!current,
    openPicker: () => inputRef.current?.click(),
  };
}
