import Link from "next/link";

import { SegmentedTab, SegmentedTabs } from "@selecta/ui/components/segmented-tabs";
import { cn } from "@selecta/ui/lib/utils";

import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/library", label: "Library" },
  { href: "/sets", label: "Sets" },
  { href: "/graph", label: "Graph" },
] as const;

function isActive(href: (typeof links)[number]["href"], currentPath?: string): boolean {
  if (!currentPath) return false;
  if (href === "/sets") {
    return (
      currentPath === "/sets" ||
      currentPath.startsWith("/sets/") ||
      currentPath === "/blocks" ||
      currentPath.startsWith("/blocks/")
    );
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function AppShell({
  children,
  currentPath,
  width = "default",
  density = "page",
}: {
  children: React.ReactNode;
  currentPath?: string;
  width?: "default" | "wide";
  density?: "page" | "workspace";
}) {
  const measure = width === "wide" ? "max-w-7xl" : "max-w-5xl";

  return (
    <div className={cn("flex min-h-full flex-col", density === "workspace" && "h-full min-h-0")}>
      <header className="border-border/80 bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div
          className={cn(
            "mx-auto flex h-14 w-full items-center justify-between gap-6 px-4 sm:px-6",
            measure,
          )}
        >
          <Link href="/" className="text-eyebrow text-sm font-semibold text-foreground">
            Selecta
          </Link>
          <div className="flex items-center gap-2">
            <SegmentedTabs aria-label="Primary">
              {links.map((link) => {
                const active = isActive(link.href, currentPath);
                return (
                  <SegmentedTab key={link.href} asChild active={active}>
                    <Link href={link.href}>{link.label}</Link>
                  </SegmentedTab>
                );
              })}
            </SegmentedTabs>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col px-4 sm:px-6",
          measure,
          density === "workspace" ? "min-h-0 pt-5 pb-8" : "py-8",
        )}
      >
        {children}
      </div>
    </div>
  );
}
