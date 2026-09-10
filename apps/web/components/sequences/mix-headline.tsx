import type { ReactNode } from "react";

import { cn } from "@selecta/ui/lib/utils";

import { MixPointReadout } from "@/components/transitions/mix-point-readout";
import { mixFacts } from "@/lib/sequences/metrics";
import type { SequenceStepTransition } from "@/lib/sequences/types";
import { hasMixPoint } from "@/lib/transitions/mix-point";
import { displayVocab } from "@/lib/transitions/vocab-labels";

function MixStat({
  label,
  empty,
  numeric = true,
  children,
}: {
  label: string;
  empty: boolean;
  numeric?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="flex w-full min-w-0 flex-col gap-0.5">
      <span className="text-eyebrow">{label}</span>
      {/* Size tokens include muted color; nest foreground so twMerge doesn't drop the size. */}
      <span
        className={cn(numeric ? "text-crate-meta" : "text-caption truncate", empty && "opacity-40")}
      >
        {empty ? <span>—</span> : <span className="text-foreground">{children}</span>}
      </span>
    </span>
  );
}

export function MixHeadline({
  transition,
  className,
}: {
  transition: Pick<
    SequenceStepTransition,
    "fromBar" | "toBar" | "fromCue" | "toCue" | "barsOverlap" | "technique"
  >;
  className?: string;
}) {
  const facts = mixFacts({
    technique: displayVocab(transition.technique),
    fromBar: transition.fromBar,
    toBar: transition.toBar,
    fromCue: transition.fromCue,
    toCue: transition.toCue,
    barsOverlap: transition.barsOverlap,
  });

  return (
    <span
      className={cn(
        "grid w-full min-w-0 grid-cols-[minmax(4.75rem,auto)_minmax(4.75rem,auto)_4.5rem_minmax(0,1fr)] items-end gap-x-3",
        className,
      )}
    >
      <MixStat label="From" empty={!hasMixPoint(transition.fromCue, transition.fromBar)}>
        <MixPointReadout cue={transition.fromCue} bar={transition.fromBar} size="sm" />
      </MixStat>
      <MixStat label="Into" empty={!hasMixPoint(transition.toCue, transition.toBar)}>
        <MixPointReadout cue={transition.toCue} bar={transition.toBar} size="sm" />
      </MixStat>
      <MixStat label="Overlap" empty={facts.overlap == null}>
        {facts.overlap != null ? String(facts.overlap) : "—"}
      </MixStat>
      <MixStat label="Type" empty={!facts.technique} numeric={false}>
        {facts.technique ?? "—"}
      </MixStat>
    </span>
  );
}
