import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@selecta/ui/lib/utils";

export function BackLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors",
        className,
      )}
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
