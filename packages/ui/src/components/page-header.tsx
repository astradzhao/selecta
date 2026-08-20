import * as React from "react";

import { cn } from "@selecta/ui/lib/utils";

function PageHeader({
  lead,
  title,
  description,
  actions,
  size = "page",
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"header">, "title"> & {
  lead?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: "page" | "section";
}) {
  return (
    <header
      data-slot="page-header"
      data-size={size}
      className={cn("space-y-4", size === "page" ? "border-border border-b pb-6" : null, className)}
      {...props}
    >
      {lead}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 space-y-2">
          <h1
            className={cn(
              size === "page" ? "text-page-title" : "text-section-title",
              "text-balance",
            )}
          >
            {title}
          </h1>
          {description ? (
            <div className="text-body text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

function PageBreadcrumb({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="page-breadcrumb" className={cn("text-eyebrow", className)} {...props} />;
}

export { PageBreadcrumb, PageHeader };
