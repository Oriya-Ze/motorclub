import { Car } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface VehicleBadgeProps {
  label: string;
  vehicleId?: string;
  className?: string;
}

/** Israeli-style plate badge for garage-linked content */
export default function VehicleBadge({ label, vehicleId, className }: VehicleBadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide",
        "bg-[#F5D033] text-[#141414] border border-[#c4a020]/80 shadow-sm",
        "hover:brightness-105 transition-all",
        className
      )}
    >
      <Car className="w-3 h-3 shrink-0" strokeWidth={2.5} />
      <span className="truncate max-w-[140px]">{label}</span>
    </span>
  );

  if (vehicleId) {
    return (
      <Link to="/garage" state={{ vehicleId }} className="inline-block">
        {badge}
      </Link>
    );
  }

  return badge;
}
