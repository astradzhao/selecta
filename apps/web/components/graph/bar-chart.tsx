import { cn } from "@selecta/ui/lib/utils";

import type { ApiTransitionEdge } from "@/lib/graph/types";
import { barStripTickCount } from "@/lib/graph/viz";
import { formatMixPoint } from "@/lib/transitions/mix-point";

export function BarChart({ transition }: { transition: ApiTransitionEdge }) {
  const fromBar = transition.fromBar;
  const toBar = transition.toBar;
  const fromPoint = formatMixPoint(transition.fromCue, fromBar);
  const intoPoint = formatMixPoint(transition.toCue, toBar);
  const ticks = barStripTickCount(fromBar, toBar, transition.barsOverlap);
  if (ticks == null && !fromPoint && !intoPoint) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-eyebrow">Mix points</p>
        <p className="text-numeric text-caption">
          {[
            fromPoint ? `from ${fromPoint}` : null,
            intoPoint ? `into ${intoPoint}` : null,
            transition.barsOverlap != null ? `overlap ${transition.barsOverlap}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {ticks == null ? null : (
        <div
          className="border-border bg-surface-2 relative flex h-6 items-end gap-px overflow-hidden rounded-md border px-1 py-1"
          role="img"
          aria-label={[
            fromPoint ? `From ${fromPoint}` : null,
            intoPoint ? `Into ${intoPoint}` : null,
            transition.barsOverlap != null ? `${transition.barsOverlap} bar overlap` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {Array.from({ length: ticks }, (_, i) => {
            const bar = i + 1;
            const isFrom = fromBar != null && bar === fromBar;
            const isTo = toBar != null && bar === toBar;
            const inOverlap =
              fromBar != null &&
              transition.barsOverlap != null &&
              bar >= fromBar &&
              bar < fromBar + transition.barsOverlap;
            return (
              <div
                key={bar}
                className={cn(
                  // Hairline bars; heights encode beat (45%) vs offbeat (28%) vs overlap (70%).
                  "min-w-0 flex-1 rounded-px",
                  isFrom || isTo
                    ? "bg-viz-bar-strong h-full"
                    : inOverlap
                      ? "bg-viz-bar-mid h-[70%]"
                      : bar % 4 === 0
                        ? "bg-viz-bar-weak h-[45%]"
                        : "bg-viz-bar-faint h-[28%]",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
