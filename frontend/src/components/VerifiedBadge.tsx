import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VerifiedBadge({ className }: { className?: string }) {
  return <BadgeCheck className={cn("w-4 h-4 text-primary inline-block shrink-0", className)} aria-hidden />;
}
