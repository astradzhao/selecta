import { pioneerHotCueSlot, type PioneerHotCue } from "@selecta/library/mix-point";
import { cn } from "@selecta/ui/lib/utils";

const PIONEER_PAD_CLASS: Record<PioneerHotCue, string> = {
  A: "border-hot-cue-a text-hot-cue-a",
  B: "border-hot-cue-b text-hot-cue-b",
  C: "border-hot-cue-c text-hot-cue-c",
  D: "border-hot-cue-d text-hot-cue-d",
  E: "border-hot-cue-e text-hot-cue-e",
  F: "border-hot-cue-f text-hot-cue-f",
  G: "border-hot-cue-g text-hot-cue-g",
  H: "border-hot-cue-h text-hot-cue-h",
};

function padLabel(cue: string): string {
  if (/^[a-h]$/i.test(cue)) return cue.toUpperCase();
  return cue.length <= 3 ? cue : cue.slice(0, 3);
}

/** Same outline mark in headlines, inspectors, editors, and phrase cards. */
export function HotCuePad({ cue, className }: { cue: string; className?: string }) {
  const trimmed = cue.trim();
  if (!trimmed) return null;
  const slot = pioneerHotCueSlot(trimmed);
  const label = padLabel(trimmed);

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-sm border bg-transparent font-sans text-xs font-semibold leading-none",
        slot ? PIONEER_PAD_CLASS[slot] : "border-tertiary text-tertiary-foreground",
        label.length > 1 && "w-auto min-w-5 px-1",
        className,
      )}
    >
      {label}
    </span>
  );
}
