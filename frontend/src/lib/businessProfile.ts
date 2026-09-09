import { ALL_BUSINESS_TYPES } from "@/lib/businessTypes";

export interface BusinessHoursDay {
  open?: string;
  close?: string;
  closed?: boolean;
}

export type BusinessHours = Record<string, BusinessHoursDay>;

export interface BusinessPublic {
  id: string;
  full_name: string;
  username?: string;
  business_type?: string | null;
  business_description?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
  business_website?: string | null;
  business_registration_id?: string | null;
  business_hours?: BusinessHours | null;
  gallery_urls?: string[] | null;
  certifications?: string[] | null;
  service_area?: { cities?: string[]; radius_km?: number } | null;
  cover_image_url?: string | null;
  profile_picture_url?: string | null;
  is_verified?: boolean;
  is_open_now?: boolean | null;
  rating_avg?: number | null;
  review_count?: number;
}

export interface BusinessService {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  price_from?: number | null;
  duration_minutes?: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface BusinessReview {
  id: string;
  business_id: string;
  rating: number;
  text?: string | null;
  created_at: string;
  reviewer?: {
    id: string;
    full_name: string;
    username?: string;
    profile_picture_url?: string | null;
  } | null;
}

export interface BusinessAnalytics {
  period_days: number;
  views: number;
  call_clicks: number;
  navigate_clicks: number;
  whatsapp_clicks: number;
  share_clicks: number;
  rating_avg?: number | null;
  review_count: number;
}

export const BUSINESS_CATEGORIES = ALL_BUSINESS_TYPES;

export const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;

export function defaultBusinessHours(): BusinessHours {
  const hours: BusinessHours = {};
  for (const key of DAY_KEYS) {
    hours[key] = key === "6" ? { closed: true } : { open: "08:00", close: "17:00", closed: false };
  }
  return hours;
}

export function getBusinessProfilePath(_businessType?: string | null, userId?: string): string {
  if (!userId) return "/profile";
  return `/services/${userId}`;
}

export function getBusinessListPath(_businessType?: string | null): string {
  return "/services";
}

export function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}`;
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function mapsEmbedUrl(address: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}
