import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-red-200 text-red-800",
        outline: "text-foreground",
        success: "border-transparent bg-green-200 text-green-800",
        warning: "border-transparent bg-yellow-200 text-yellow-800",
        info: "border-transparent bg-blue-200 text-blue-800",
        orange: "border-transparent bg-orange-200 text-orange-800",
        pink: "border-transparent bg-pink-200 text-pink-800",
        purple: "border-transparent bg-purple-200 text-purple-800",
        silver: "border-transparent bg-gray-200 text-gray-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
