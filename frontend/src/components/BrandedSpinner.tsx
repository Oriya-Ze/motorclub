import LogoLoader from "@/components/LogoLoader";

/** Kept for existing callers; the loading indicator is the logo. */
export default function BrandedSpinner({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  return <LogoLoader size={size} className={className} />;
}
