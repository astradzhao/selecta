"use client";

import { cn } from "@selecta/ui/lib/utils";

export type SegmentedTone = "success" | "warning" | "info" | "tertiary";

export type SegmentedOption = {
  value: string;
  label: string;
  tone?: SegmentedTone;
};

const PRESSED_TONE: Record<SegmentedTone, string> = {
  success: "bg-success-subtle text-success shadow-sm",
  warning: "bg-warning-subtle text-warning shadow-sm",
  info: "bg-info-subtle text-info shadow-sm",
  tertiary: "bg-tertiary text-tertiary-foreground shadow-sm",
};

const IDLE_TONE: Record<SegmentedTone, string> = {
  success: "text-success hover:text-success",
  warning: "text-warning hover:text-warning",
  info: "text-info hover:text-info",
  tertiary: "text-muted-foreground hover:text-foreground",
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
        const tone = option.tone;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={pressed}
            className={cn(
              "rounded-md text-xs font-medium transition-colors disabled:opacity-50",
              pressed
                ? tone
                  ? PRESSED_TONE[tone]
                  : "bg-background text-foreground shadow-sm"
                : tone
                  ? IDLE_TONE[tone]
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
