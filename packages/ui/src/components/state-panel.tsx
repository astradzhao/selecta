import * as React from "react";

import { cn } from "@selecta/ui/lib/utils";

type StatePanelVariant = "loading" | "error" | "empty";

function StatePanel({
  variant = "empty",
  title,
  description,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  variant?: StatePanelVariant;
  title?: React.ReactNode;
  description?: React.ReactNode;
}) {
  const isLoading = variant === "loading";

  return (
    <div
      data-slot="state-panel"
      data-variant={variant}
      aria-busy={isLoading || undefined}
      role={isLoading ? "status" : undefined}
      className={cn(
        "border-border rounded-xl border",
        variant === "error" ? "bg-surface-1 px-5 py-6" : "px-5 py-10",
        isLoading && "text-muted-foreground text-sm",
        className,
      )}
      {...props}
    >
      {title ? <h2 className="text-card-title">{title}</h2> : null}
      {description ? (
        <p className={cn("text-body text-muted-foreground max-w-xl", title && "mt-1")}>
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export { StatePanel };
