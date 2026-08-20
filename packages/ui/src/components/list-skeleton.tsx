import { Skeleton } from "@selecta/ui/components/skeleton";
import { cn } from "@selecta/ui/lib/utils";

function ListSkeleton({
  rows = 5,
  className,
  "aria-label": ariaLabel = "Loading",
}: {
  rows?: number;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      data-slot="list-skeleton"
      className={cn(
        "divide-border border-border divide-y overflow-hidden rounded-xl border",
        className,
      )}
      aria-busy="true"
      aria-label={ariaLabel}
      role="status"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2 px-4 py-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export { ListSkeleton };
