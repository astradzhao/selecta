"use client";

import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@selecta/ui/lib/utils";

type SegmentedTabsVariant = "line" | "boxed";

const SegmentedTabsContext = React.createContext<SegmentedTabsVariant>("line");

function SegmentedTabs({
  variant = "line",
  className,
  ...props
}: React.ComponentProps<"nav"> & { variant?: SegmentedTabsVariant }) {
  return (
    <SegmentedTabsContext.Provider value={variant}>
      <nav
        data-slot="segmented-tabs"
        data-variant={variant}
        className={cn(
          variant === "boxed" ? "bg-muted inline-flex rounded-lg p-0.5" : "flex flex-wrap gap-1",
          className,
        )}
        {...props}
      />
    </SegmentedTabsContext.Provider>
  );
}

function SegmentedTab({
  active = false,
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean; asChild?: boolean }) {
  const variant = React.useContext(SegmentedTabsContext);
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="segmented-tab"
      data-active={active ? "true" : undefined}
      aria-current={asChild && active ? "page" : undefined}
      aria-pressed={!asChild ? active : undefined}
      className={cn(
        "outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        variant === "boxed"
          ? cn(
              "rounded-lg px-2.5 py-1 text-xs font-medium disabled:opacity-50",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )
          : cn(
              "relative inline-flex items-center rounded-lg px-3 py-1.5 text-sm",
              active
                ? "text-selected-foreground font-medium after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-selected after:content-['']"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            ),
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedTab, SegmentedTabs };
