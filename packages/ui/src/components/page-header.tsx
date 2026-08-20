import * as React from "react";

import { cn } from "@selecta/ui/lib/utils";

function PageHeader({
  lead,
  title,
  description,
  actions,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"header">, "title"> & {
  lead?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header
      data-slot="page-header"
      className={cn("border-border space-y-4 border-b pb-6", className)}
      {...props}
    >
      {lead}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page-title text-balance">{title}</h1>
          {actions}
        </div>
        {description ? (
          <div className="text-body text-muted-foreground max-w-xl">{description}</div>
        ) : null}
      </div>
      {children}
    </header>
  );
}

function PageBreadcrumb({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="page-breadcrumb" className={cn("text-eyebrow", className)} {...props} />;
}

export { PageBreadcrumb, PageHeader };
