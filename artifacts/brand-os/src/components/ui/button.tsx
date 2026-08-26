import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "glass";
  size?: "default" | "sm" | "lg" | "icon";
}

export function buttonVariants({
  variant = "default",
  size = "default",
}: Pick<ButtonProps, "variant" | "size"> = {}) {
  return cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-bold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
    {
      "bg-primary text-primary-foreground shadow-[0_8px_16px_-6px_rgba(15,31,61,0.4)] hover:shadow-[0_12px_20px_-6px_rgba(15,31,61,0.5)] hover:-translate-y-0.5": variant === "default",
      "bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === "secondary",
      "border-2 border-border bg-transparent hover:bg-muted hover:border-gray-300": variant === "outline",
      "hover:bg-muted hover:text-foreground": variant === "ghost",
      "bg-white/70 backdrop-blur-md border border-white/20 shadow-sm hover:bg-white/90 text-foreground": variant === "glass",
      "h-14 px-6 py-4 text-base": size === "default",
      "h-10 px-4 text-sm rounded-xl": size === "sm",
      "h-16 px-8 text-lg": size === "lg",
      "h-12 w-12 rounded-xl": size === "icon",
    },
  );
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
