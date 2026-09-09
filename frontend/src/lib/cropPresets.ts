import type { MediaPurpose } from "@/lib/mediaUpload";

export type CropPurpose = MediaPurpose | "cover";

export interface CropPreset {
  aspect: number;
  cropShape: "rect" | "round";
  titleKey: string;
  hintKey: string;
}

export const CROP_PRESETS: Record<CropPurpose, CropPreset> = {
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
  product: {
    aspect: 1,
    cropShape: "rect",
    titleKey: "crop.titleProduct",
    hintKey: "crop.hintProduct",
  },
  cover: {
    aspect: 16 / 9,
    cropShape: "rect",
    titleKey: "crop.titleCover",
    hintKey: "crop.hintCover",
  },
};
