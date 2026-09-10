import { cn } from "@selecta/ui/lib/utils";

import { mixFacts } from "@/lib/sequences/metrics";
import type { SequenceStepTransition } from "@/lib/sequences/types";
import { displayVocab } from "@/lib/transitions/vocab-labels";

function MixStat({
  label,
  value,
  numeric = true,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  const empty = value === "—";
  return (
    <span className="flex w-full min-w-0 flex-col gap-0.5">
      <span className="text-eyebrow">{label}</span>
      {/* Size tokens include muted color; nest foreground so twMerge doesn't drop the size. */}
      <span
        className={cn(numeric ? "text-crate-meta" : "text-caption truncate", empty && "opacity-40")}
      >
        <span className={empty ? undefined : "text-foreground"}>{value}</span>
      </span>
    </span>
  );
}

export function MixHeadline({
  transition,
  className,
}: {
  transition: Pick<SequenceStepTransition, "fromBar" | "toBar" | "barsOverlap" | "technique">;
  className?: string;
}) {
  const facts = mixFacts({
    technique: displayVocab(transition.technique),
    fromBar: transition.fromBar,
    toBar: transition.toBar,
    barsOverlap: transition.barsOverlap,
  });

  return (
    <span
      className={cn(
        "grid w-full min-w-0 grid-cols-[2.5rem_2.25rem_4.5rem_minmax(0,1fr)] items-end gap-x-3",
        className,
      )}
    >
      <MixStat label="Out" value={facts.out != null ? String(facts.out) : "—"} />
      <MixStat label="In" value={facts.in != null ? String(facts.in) : "—"} />
      <MixStat label="Overlap" value={facts.overlap != null ? String(facts.overlap) : "—"} />
      <MixStat label="Type" value={facts.technique ?? "—"} numeric={false} />
    </span>
  );
}
