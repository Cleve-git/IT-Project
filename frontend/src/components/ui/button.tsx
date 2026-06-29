import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-[10px] transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
    
    const variants = {
      primary: "bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm shadow-primary/10 active:scale-[0.98]",
      secondary: "bg-muted text-foreground border border-border hover:bg-border/60 active:scale-[0.98]",
      outline: "border border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]",
      ghost: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      danger: "bg-danger hover:bg-danger/90 text-white shadow-sm shadow-danger/10 active:scale-[0.98]"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-xs",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base"
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
