import * as React from "react";

import { cn } from "@selecta/ui/lib/utils";

function EmptyState({
  title,
  description,
  className,
  children,
  compact = false,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <p
        data-slot="empty-state"
        className={cn(
          "border-border text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm",
          className,
        )}
      >
        {title ?? children}
      </p>
    );
  }

  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-start gap-3 px-5 py-10", className)}
    >
      {title || description ? (
        <div>
          {title ? <h2 className="text-card-title">{title}</h2> : null}
          {description ? (
            <p className={cn("text-body text-muted-foreground", title && "mt-1")}>{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export { EmptyState };
