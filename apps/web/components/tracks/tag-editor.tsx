"use client";

import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

import { listVocab } from "@/lib/vocab/api";

export type TagItem = {
  name: string;
};

const SUGGESTION_LIMIT = 24;

export function TagEditor({
  id,
  label,
  hint,
  placeholder,
  values,
  onChange,
  badgeVariant = "secondary",
  /** When set, loads existing library vocab and shows clickable suggestions. */
  vocab,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder: string;
  values: TagItem[];
  onChange: (next: TagItem[]) => void;
  badgeVariant?: "secondary" | "outline";
  vocab?: "genres" | "subgenres";
}) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<TagItem[]>([]);

  useEffect(() => {
    if (!vocab) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await listVocab(vocab, { limit: 100 });
        if (cancelled) return;
        setSuggestions(response.items.map((item) => ({ name: item.name })));
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vocab]);

  function addTag(raw: string) {
    const name = raw.trim();
    if (!name) return;
    if (values.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    onChange([...values, { name }]);
    setDraft("");
  }

  const selected = new Set(values.map((item) => item.name.toLowerCase()));
  const draftTokens = draft.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visibleSuggestions = suggestions
    .filter((item) => !selected.has(item.name.toLowerCase()))
    .filter((item) => {
      if (draftTokens.length === 0) return true;
      const haystack = item.name.toLowerCase();
      return draftTokens.every((token) => haystack.includes(token));
    })
    .slice(0, SUGGESTION_LIMIT);

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addTag(event.currentTarget.value);
          }
        }}
      />
      {vocab && (visibleSuggestions.length > 0 || values.length > 0) ? (
        <div className="flex flex-row flex-wrap items-center gap-1.5">
          {values.map((item) => (
            <Badge key={`selected-${item.name}`} variant={badgeVariant} className="gap-1 pr-1">
              {item.name}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Remove ${item.name}`}
                onClick={() => onChange(values.filter((v) => v.name !== item.name))}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          {visibleSuggestions.map((item) => (
            <button
              key={`suggest-${item.name}`}
              type="button"
              className="border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center rounded-md border px-2 py-0.5 text-xs transition-colors"
              onClick={() => addTag(item.name)}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : values.length > 0 ? (
        <div className="flex flex-row flex-wrap items-center gap-1.5">
          {values.map((item) => (
            <Badge key={item.name} variant={badgeVariant} className="gap-1 pr-1">
              {item.name}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-black/10"
                aria-label={`Remove ${item.name}`}
                onClick={() => onChange(values.filter((v) => v.name !== item.name))}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
