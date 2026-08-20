import * as React from "react";

import { cn } from "@selecta/ui/lib/utils";

function SectionHeading({
  title,
  hint,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & {
  title: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div data-slot="section-heading" className={cn("space-y-1", className)} {...props}>
      <h2 className="text-section-title">{title}</h2>
      {hint ? <p className="text-caption">{hint}</p> : null}
    </div>
  );
}

export { SectionHeading };
