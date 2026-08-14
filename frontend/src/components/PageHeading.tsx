import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeadingProps {
  children: ReactNode;
  subtitle?: string;
  className?: string;
}

export default function PageHeading({ children, subtitle, className }: PageHeadingProps) {
  return (
    <header className={cn("space-y-1 mb-4", className)}>
      <h1 className="text-2xl sm:text-3xl font-display tracking-wide text-foreground">{children}</h1>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      <div className="h-0.5 w-12 rounded-full gradient-primary mt-2" aria-hidden />
    </header>
  );
}
