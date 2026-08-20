import { cn } from "@selecta/ui/lib/utils";

import type { ApiTransitionEdge } from "@/lib/graph/types";
import { clampConfidence, formatGraphLabel, qualityFill } from "@/lib/graph/viz";

export function QualityMeter({ transition }: { transition: ApiTransitionEdge }) {
  const confidence = clampConfidence(transition.confidence);

  return (
    <div className="grid grid-cols-2 gap-3">
      <MeterRow
        label="Quality"
        valueLabel={formatGraphLabel(transition.quality) ?? "Unrated"}
        fill={qualityFill(transition.quality)}
      />
      <MeterRow
        label="Confidence"
        valueLabel={confidence != null ? `${Math.round(confidence * 100)}%` : "—"}
        fill={confidence}
      />
    </div>
  );
}

function MeterRow({
  label,
  valueLabel,
  fill,
}: {
  label: string;
  valueLabel: string;
  fill: number | null;
}) {
  return (
    <div className="space-y-1">
      <div className="text-caption flex items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="text-numeric text-foreground">{valueLabel}</span>
      </div>
      <div className="bg-viz-meter-track h-1 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full",
            fill == null ? "bg-viz-meter-empty" : "bg-viz-meter-fill",
          )}
          style={{ width: `${Math.round((fill ?? 0.08) * 100)}%` }}
        />
      </div>
    </div>
  );
}
