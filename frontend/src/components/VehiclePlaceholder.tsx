import { Car } from "lucide-react";
import { cn } from "@/lib/utils";

interface VehiclePlaceholderProps {
  className?: string;
  iconClassName?: string;
}

export default function VehiclePlaceholder({ className, iconClassName }: VehiclePlaceholderProps) {
  return (
    <div className={cn("w-full bg-asphalt flex items-center justify-center", className)}>
      <Car className={cn("w-12 h-12 text-muted-foreground/40", iconClassName)} strokeWidth={1.25} />
    </div>
  );
}
