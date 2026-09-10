import { pioneerHotCueSlot, type PioneerHotCue } from "@selecta/library/mix-point";
import { cn } from "@selecta/ui/lib/utils";

const PIONEER_PAD_CLASS: Record<PioneerHotCue, string> = {
  A: "bg-hot-cue-a text-hot-cue-a-foreground",
  B: "bg-hot-cue-b text-hot-cue-b-foreground",
  C: "bg-hot-cue-c text-hot-cue-c-foreground",
  D: "bg-hot-cue-d text-hot-cue-d-foreground",
  E: "bg-hot-cue-e text-hot-cue-e-foreground",
  F: "bg-hot-cue-f text-hot-cue-f-foreground",
  G: "bg-hot-cue-g text-hot-cue-g-foreground",
  H: "bg-hot-cue-h text-hot-cue-h-foreground",
};

const SIZE_CLASS = {
  sm: "size-5 rounded-sm text-xs font-semibold",
  md: "size-5 rounded-sm text-xs font-semibold",
  lg: "size-7 rounded-md text-sm font-semibold",
} as const;

function padLabel(cue: string): string {
  if (/^[a-h]$/i.test(cue)) return cue.toUpperCase();
  return cue.length <= 3 ? cue : cue.slice(0, 3);
}

export function HotCuePad({
  cue,
  size = "md",
  className,
}: {
  cue: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const trimmed = cue.trim();
  if (!trimmed) return null;
  const slot = pioneerHotCueSlot(trimmed);
  const label = padLabel(trimmed);

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center leading-none",
        SIZE_CLASS[size],
        slot ? PIONEER_PAD_CLASS[slot] : "bg-tertiary text-tertiary-foreground",
        label.length > 1 && "w-auto min-w-0 px-1",
        className,
      )}
    >
      {label}
    </span>
  );
}
