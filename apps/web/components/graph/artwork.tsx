"use client";

import Image from "next/image";

import { cn } from "@selecta/ui/lib/utils";

import { HERO_ART_SIZE } from "@/lib/motion";

export function GraphArtwork({
  url,
  variant,
  className,
  sizes,
  priority = false,
}: {
  url: string | null;
  variant: "card" | "hero";
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      data-art-role={variant}
      className={cn(
        "bg-muted relative shrink-0 overflow-hidden",
        // Hero square is 13.75rem (220px) — keep in lockstep with HERO_ART_SIZE for art flight.
        variant === "hero" ? "size-[13.75rem] rounded-2xl" : "size-14 rounded-xl",
        className,
      )}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          priority={priority}
          className="object-cover"
          sizes={sizes ?? (variant === "hero" ? `${HERO_ART_SIZE}px` : "56px")}
        />
      ) : (
        <div className="text-eyebrow text-muted-foreground/40 flex h-full w-full items-center justify-center">
          No art
        </div>
      )}
    </div>
  );
}
