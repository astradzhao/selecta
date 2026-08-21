"use client";

import * as React from "react";

import { Input } from "@selecta/ui/components/input";
import { cn } from "@selecta/ui/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
};

function displayValue(value: string, options: readonly ComboboxOption[]): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function filterOptions(query: string, options: readonly ComboboxOption[]): ComboboxOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...options];
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle),
  );
}

function resolveValue(raw: string, options: readonly ComboboxOption[]): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const match = options.find(
    (option) => option.label.toLowerCase() === lower || option.value.toLowerCase() === lower,
  );
  return match?.value ?? trimmed;
}

function Combobox({
  value,
  onChange,
  options,
  disabled,
  placeholder,
  id,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly ComboboxOption[];
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const shown = displayValue(value, options);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(shown);
  const [highlight, setHighlight] = React.useState(0);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  React.useEffect(() => {
    if (!open) setDraft(shown);
  }, [shown, open]);

  const filtered = filterOptions(draft, options);
  const offerCustom = Boolean(draft.trim()) && filtered.length === 0;
  const itemCount = filtered.length + (offerCustom ? 1 : 0);
  const activeIndex = itemCount === 0 ? -1 : Math.min(highlight, itemCount - 1);
  const activeId =
    activeIndex < 0
      ? undefined
      : activeIndex < filtered.length
        ? `${listId}-opt-${activeIndex}`
        : `${listId}-custom`;

  function commitDraft(nextDraft = draft) {
    onChange(resolveValue(nextDraft, options));
  }

  function pick(option: ComboboxOption) {
    onChange(option.value);
    setDraft(option.label);
    setOpen(false);
  }

  function pickCustom() {
    commitDraft();
    setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      onChange(resolveValue(draftRef.current, options));
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, options, onChange]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(0);
        return;
      }
      if (itemCount === 0) return;
      setHighlight((current) => (current + 1) % itemCount);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setHighlight(Math.max(itemCount - 1, 0));
        return;
      }
      if (itemCount === 0) return;
      setHighlight((current) => (current - 1 + itemCount) % itemCount);
      return;
    }
    if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      if (activeIndex < 0) {
        commitDraft();
        setOpen(false);
        return;
      }
      if (activeIndex < filtered.length) {
        const option = filtered[activeIndex];
        if (option) pick(option);
        return;
      }
      pickCustom();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(shown);
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? activeId : undefined}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={open ? draft : shown}
        onChange={(event) => {
          setDraft(event.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setDraft(shown);
          setOpen(true);
          setHighlight(0);
        }}
        onBlur={() => {
          commitDraft();
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && itemCount > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="border-border bg-popover text-popover-foreground absolute top-[calc(100%+6px)] right-0 left-0 z-20 overflow-hidden rounded-lg border shadow-md"
        >
          {filtered.map((option, index) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                id={`${listId}-opt-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  "w-full px-2.5 py-2 text-left text-sm",
                  index === activeIndex ? "bg-surface-2" : "hover:bg-surface-2",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(option)}
              >
                {option.label}
              </button>
            </li>
          ))}
          {offerCustom ? (
            <li role="presentation">
              <button
                type="button"
                id={`${listId}-custom`}
                role="option"
                aria-selected={activeIndex === filtered.length}
                className={cn(
                  "text-muted-foreground border-border w-full border-t px-2.5 py-2 text-left text-sm italic",
                  activeIndex === filtered.length ? "bg-surface-2" : "hover:bg-surface-2",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlight(filtered.length)}
                onClick={pickCustom}
              >
                Use “{draft.trim()}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export { Combobox };
