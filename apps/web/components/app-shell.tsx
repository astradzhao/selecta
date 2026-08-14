import Link from "next/link";

import { cn } from "@selecta/ui/lib/utils";

import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/add", label: "Add" },
  { href: "/library", label: "Library" },
  { href: "/graph", label: "Graph" },
] as const;

export function AppShell({
  children,
  currentPath,
}: {
  children: React.ReactNode;
  currentPath?: string;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-border/80 bg-background/90 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-4 sm:px-6">
          <Link href="/" className="text-eyebrow text-sm font-semibold text-foreground">
            Selecta
          </Link>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {links.map((link) => {
                const active =
                  currentPath === link.href || (currentPath?.startsWith(`${link.href}/`) ?? false);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-selected text-selected-foreground"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}
