import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "default" | "ghost" | "outline" | "destructive";
type ButtonSize = "default" | "sm" | "lg" | "icon";

export function buttonClassName({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    {
      "gradient-primary text-primary-foreground shadow-glow hover:opacity-90": variant === "default",
      "hover:bg-muted text-foreground": variant === "ghost",
      "border border-border bg-transparent hover:bg-muted": variant === "outline",
      "bg-destructive text-destructive-foreground hover:opacity-90": variant === "destructive",
      "h-11 px-6 py-2": size === "default",
      "h-9 px-4 text-sm": size === "sm",
      "h-12 px-8 text-lg": size === "lg",
      "h-10 w-10": size === "icon",
    },
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return <button ref={ref} className={buttonClassName({ variant, size, className })} {...props} />;
  }
);
Button.displayName = "Button";
