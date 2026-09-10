import { cn } from "@selecta/ui/lib/utils";

import { HotCuePad } from "@/components/transitions/hot-cue-pad";
import { mixPointText } from "@/lib/transitions/mix-point";

const BAR_CLASS = {
  sm: "font-mono tabular-nums",
  md: "text-numeric text-body",
  lg: "text-section-title text-numeric",
} as const;

export function MixPointReadout({
  cue,
  bar,
  size = "md",
  className,
}: {
  cue: string | null | undefined;
  bar: number | null | undefined;
  size?: keyof typeof BAR_CLASS;
  className?: string;
}) {
  const text = mixPointText(cue, bar);
  const empty = text === "—";
  const label = cue?.trim() || null;
  const measure = bar != null && Number.isFinite(bar) ? String(bar) : null;

  if (empty) {
    return (
      <span className={cn(BAR_CLASS[size], "text-muted-foreground opacity-40", className)}>—</span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex min-w-0 items-center gap-1.5">
        {label ? <HotCuePad cue={label} size={size} /> : null}
        {measure ? <span className={BAR_CLASS[size]}>{measure}</span> : null}
      </span>
    </span>
  );
}
