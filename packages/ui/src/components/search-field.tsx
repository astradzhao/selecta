import { SearchIcon } from "lucide-react";

import { Input } from "@selecta/ui/components/input";
import { cn } from "@selecta/ui/lib/utils";

function SearchField({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div data-slot="search-field" className="relative">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input className={cn("pl-10", className)} {...props} />
    </div>
  );
}

export { SearchField };
