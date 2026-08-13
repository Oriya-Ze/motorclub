import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("text-center py-16 px-4 space-y-4", className)}>
      <div className="mx-auto w-20 h-20 rounded-2xl bg-asphalt border border-border/50 flex items-center justify-center">
        <Icon className="w-10 h-10 text-muted-foreground/50" strokeWidth={1.25} />
      </div>
      <div className="space-y-2">
        <p className="font-display text-2xl tracking-wide text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>}
      </div>
      {action}
    </div>
  );
}
