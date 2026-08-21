"use client";

import { cn } from "@selecta/ui/lib/utils";

export type SegmentedOption = {
  value: string;
  label: string;
};

function Segmented({
  value,
  onChange,
  options,
  disabled,
  className,
  id,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SegmentedOption[];
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      id={id}
      role="group"
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className={cn("bg-muted grid h-8 rounded-lg p-0.5", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={pressed}
            className={cn(
              "rounded-md text-xs font-medium transition-colors disabled:opacity-50",
              pressed
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(pressed ? "" : option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export { Segmented };
