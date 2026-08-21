import { Badge } from "@selecta/ui/components/badge";
import { cn } from "@selecta/ui/lib/utils";

import type { ApiNamedNode } from "@/lib/tracks/types";

/** Hero chips under the track title — Subgenres only (folders live in the detail grid). */
export function TrackChips({
  subgenres,
  limit,
  className,
}: {
  subgenres: ApiNamedNode[];
  limit?: number;
  className?: string;
}) {
  const items = limit != null ? subgenres.slice(0, limit) : subgenres;
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-row flex-wrap items-center gap-1.5", className)}>
      {items.map((item) => (
        <Badge key={`sg-${item.id}`} variant="tertiary" className="w-fit">
          {item.name}
        </Badge>
      ))}
    </div>
  );
}
