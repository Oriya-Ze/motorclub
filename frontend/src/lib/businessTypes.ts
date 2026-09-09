export const WORKSHOP_BUSINESS_TYPES = ["garage", "mechanic", "body_shop", "tires", "electric"] as const;

export const SERVICE_BUSINESS_TYPES = ["towing", "detailing", "insurance", "rental", "parts", "other"] as const;

export const ALL_BUSINESS_TYPES = [...WORKSHOP_BUSINESS_TYPES, ...SERVICE_BUSINESS_TYPES] as const;

export type BusinessType = (typeof ALL_BUSINESS_TYPES)[number];

export function isWorkshopType(businessType?: string | null): boolean {
  return Boolean(
    businessType && WORKSHOP_BUSINESS_TYPES.includes(businessType as (typeof WORKSHOP_BUSINESS_TYPES)[number])
  );
}

export interface BusinessUpgradeFormData {
  business_name: string;
  business_type: BusinessType;
  business_phone: string;
  business_address: string;
  business_description: string;
  contact_full_name: string;
  contact_phone: string;
  business_registration_id?: string;
  business_website?: string;
  additional_notes?: string;
}

export interface BusinessUpgradeRequest {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  business_name: string | null;
  business_type: string | null;
  business_description: string | null;
  business_phone: string | null;
  business_address: string | null;
  business_registration_id: string | null;
  business_website: string | null;
  contact_full_name: string | null;
  contact_phone: string | null;
  additional_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface BusinessUpgradeRequestAdmin extends BusinessUpgradeRequest {
  applicant_email: string;
  applicant_username: string;
  admin_notes: string | null;
}
