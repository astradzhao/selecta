import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@selecta/ui/lib/utils";

function DataList({
  className,
  variant = "divided",
  ...props
}: React.ComponentProps<"ul"> & { variant?: "divided" | "plain" }) {
  return (
    <ul
      data-slot="data-list"
      data-variant={variant}
      className={cn(
        variant === "divided" &&
          "divide-border border-border divide-y overflow-hidden rounded-xl border",
        variant === "plain" && "space-y-2",
        className,
      )}
      {...props}
    />
  );
}

function DataListSection({
  title,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & { title?: React.ReactNode }) {
  return (
    <div data-slot="data-list-section" className={cn("space-y-3", className)} {...props}>
      {title}
      {children}
    </div>
  );
}

const rowInteractiveClassName =
  "hover:bg-surface-2 focus-visible:bg-surface-2 flex px-4 py-3 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function DataListRow({
  className,
  variant = "default",
  interactive = true,
  children,
  ...props
}: React.ComponentProps<"li"> & {
  variant?: "default" | "dashed";
  interactive?: boolean;
}) {
  return (
    <li data-slot="data-list-row" {...props}>
      {interactive ? (
        <Slot.Root
          className={cn(
            rowInteractiveClassName,
            variant === "dashed" && "rounded-xl border border-dashed",
            className,
          )}
        >
          {children}
        </Slot.Root>
      ) : (
        children
      )}
    </li>
  );
}

export { DataList, DataListRow, DataListSection };
