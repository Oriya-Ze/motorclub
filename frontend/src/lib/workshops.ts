export const WORKSHOP_SPECIALTIES = ["garage", "mechanic", "body_shop", "tires", "electric"] as const;

export type WorkshopSpecialty = (typeof WORKSHOP_SPECIALTIES)[number];

export interface WorkshopBusiness {
  id: string;
  full_name: string;
  username?: string;
  business_type?: string | null;
  business_description?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
  profile_picture_url?: string | null;
  is_verified?: boolean;
  is_open_now?: boolean | null;
  rating_avg?: number | null;
  review_count?: number;
}
