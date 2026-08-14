import { cn } from "@/lib/utils";

interface BrandedSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-5 h-5",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

export default function BrandedSpinner({ size = "md", className }: BrandedSpinnerProps) {
  return (
    <div
      className={cn("relative", sizes[size], className)}
      role="status"
      aria-label="Loading"
    >
      <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
      <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin shadow-glow" />
    </div>
  );
}
