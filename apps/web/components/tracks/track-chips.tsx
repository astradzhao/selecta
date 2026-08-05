import { Badge } from "@selecta/ui/components/badge";

import type { ApiFolderNode, ApiNamedNode } from "@/lib/tracks/types";

export function TrackChips({
  subgenres,
  folders,
}: {
  subgenres: ApiNamedNode[];
  folders: ApiFolderNode[];
}) {
  if (subgenres.length === 0 && folders.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {subgenres.map((item) => (
        <Badge key={`sg-${item.id}`} variant="secondary">
          {item.name}
        </Badge>
      ))}
      {folders.map((item) => (
        <Badge key={`f-${item.id}`} variant="outline">
          {item.name}
          {item.kind ? <span className="text-muted-foreground"> · {item.kind}</span> : null}
        </Badge>
      ))}
    </div>
  );
}
