"use client";

import { useEffect, useId, useState } from "react";
import { XIcon } from "lucide-react";

import { FOLDER_KINDS, type FolderKind } from "@selecta/db/constants";
import { Badge } from "@selecta/ui/components/badge";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

import { listVocab, type VocabFolderItem } from "@/lib/vocab/api";

export type FolderTag = {
  name: string;
  kind?: FolderKind;
};

const SUGGESTION_LIMIT = 24;

export function FolderTagEditor({
  values,
  onChange,
}: {
  values: FolderTag[];
  onChange: (next: FolderTag[]) => void;
}) {
  const inputId = useId();
  const kindId = useId();
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<FolderKind | "">("");
  const [suggestions, setSuggestions] = useState<VocabFolderItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listVocab("folders", { limit: 100 });
        if (cancelled) return;
        setSuggestions(response.items);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function addFolder(nameRaw: string, nextKind?: FolderKind | "") {
    const name = nameRaw.trim();
    if (!name) return;
    if (values.some((item) => item.name.toLowerCase() === name.toLowerCase())) return;
    const existing = suggestions.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const resolvedKind =
      nextKind ||
      kind ||
      (existing?.kind === "folder" || existing?.kind === "playlist" ? existing.kind : undefined);
    onChange([
      ...values,
      { name: existing?.name ?? name, ...(resolvedKind ? { kind: resolvedKind } : {}) },
    ]);
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
        <Label htmlFor={inputId}>Folders</Label>
        <p className="text-muted-foreground text-xs">
          Playlists, folders, and set buckets — separate from musical subgenres.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          className="flex-1"
          value={draft}
          placeholder="Add folder, then Enter — or pick one below"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addFolder(event.currentTarget.value);
          }}
        />
        <select
          id={kindId}
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={kind}
          aria-label="Folder kind"
          onChange={(event) => setKind(event.target.value as FolderKind | "")}
        >
          <option value="">Kind (optional)</option>
          {FOLDER_KINDS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      {visibleSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Existing folders">
          {visibleSuggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              className="border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md border px-2 py-0.5 text-xs transition-colors"
              onClick={() =>
                addFolder(
                  item.name,
                  item.kind === "folder" || item.kind === "playlist" ? item.kind : "",
                )
              }
            >
              {item.name}
              {item.kind ? <span className="text-muted-foreground/80"> · {item.kind}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((item) => (
            <Badge key={item.name} variant="outline" className="gap-1 pr-1">
              {item.name}
              {item.kind ? <span className="text-muted-foreground">· {item.kind}</span> : null}
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
