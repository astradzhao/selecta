import { Badge } from "@selecta/ui/components/badge";

import type { ApiNamedNode } from "@/lib/tracks/types";

/** Hero chips under the track title — Subgenres only (folders live in the detail grid). */
export function TrackChips({ subgenres }: { subgenres: ApiNamedNode[] }) {
  if (subgenres.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-row flex-wrap items-center gap-1.5">
      {subgenres.map((item) => (
        <Badge key={`sg-${item.id}`} variant="secondary" className="w-fit">
          {item.name}
        </Badge>
      ))}
    </div>
  );
}
