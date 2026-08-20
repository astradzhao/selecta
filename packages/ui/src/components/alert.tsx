import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@selecta/ui/lib/utils";

import { alertRole, type AlertVariant } from "./alert-role";

const alertVariants = cva(
  "relative grid w-full gap-0.5 rounded-lg border px-3 py-2 text-body has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        info: "border-info/30 bg-info-subtle text-info",
        success: "border-success/30 bg-success-subtle text-success",
        warning: "border-warning/30 bg-warning-subtle text-warning",
        destructive: "border-destructive/30 bg-destructive-subtle text-destructive",
      } satisfies Record<AlertVariant, string>,
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

function Alert({
  className,
  variant = "info",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role={alertRole(variant ?? "info")}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="alert-title" className={cn("text-card-title", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-body opacity-90", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle, alertVariants };
