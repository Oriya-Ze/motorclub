import type { MediaPurpose } from "@/lib/mediaUpload";

export interface CropPreset {
  aspect: number;
  cropShape: "rect" | "round";
  titleKey: string;
  hintKey: string;
}

export const CROP_PRESETS: Record<MediaPurpose, CropPreset> = {
  post: {
    aspect: 4 / 3,
    cropShape: "rect",
    titleKey: "crop.titlePost",
    hintKey: "crop.hintPost",
  },
  avatar: {
    aspect: 1,
    cropShape: "round",
    titleKey: "crop.titleAvatar",
    hintKey: "crop.hintAvatar",
  },
  vehicle: {
    aspect: 16 / 9,
    cropShape: "rect",
    titleKey: "crop.titleVehicle",
    hintKey: "crop.hintVehicle",
  },
  story: {
    aspect: 9 / 16,
    cropShape: "rect",
    titleKey: "crop.titleStory",
    hintKey: "crop.hintStory",
  },
};
