"use client";

import { useEffect, useId, useState } from "react";
import { XIcon } from "lucide-react";

import { FOLDER_KINDS, type FolderKind } from "@selecta/db/constants";
import { Badge } from "@selecta/ui/components/badge";
import { Field, FieldDescription, FieldLabel } from "@selecta/ui/components/field";
import { Input } from "@selecta/ui/components/input";
import { Select } from "@selecta/ui/components/select";

import { canAddTag, filterTagSuggestions } from "@/lib/tags/suggestions";
import { listVocab, type VocabNamedItem } from "@/lib/vocab/api";

export type TagItem = {
  name: string;
};

export type FolderTag = {
  name: string;
  kind: FolderKind;
};

const SUGGESTION_LIMIT = 24;
const DEFAULT_KIND: FolderKind = "playlist";

type Suggestion = {
  name: string;
  kind?: FolderKind | null;
};

type TagEditorBase = {
  id?: string;
  label: string;
  hint?: string;
  placeholder: string;
  badgeVariant?: "secondary" | "outline";
};

type NamedEditorProps = TagEditorBase & {
  kind?: false;
  vocab?: "genres" | "subgenres";
  values: TagItem[];
  onChange: (next: TagItem[]) => void;
};

type FolderEditorProps = TagEditorBase & {
  kind: true;
  vocab?: "folders";
  values: FolderTag[];
  onChange: (next: FolderTag[]) => void;
  defaultKind?: FolderKind;
};

export function TagEditor(props: NamedEditorProps | FolderEditorProps) {
  const inputId = useId();
  const kindId = useId();
  const id = props.id ?? inputId;
  const withKind = props.kind === true;
  const vocab = withKind ? (props.vocab ?? "folders") : props.vocab;
  const badgeVariant = props.badgeVariant ?? (withKind ? "outline" : "secondary");
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<FolderKind>(
    withKind ? (props.defaultKind ?? DEFAULT_KIND) : DEFAULT_KIND,
  );
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (!vocab) return;
    let cancelled = false;
    void (async () => {
      try {
        if (vocab === "folders") {
          const response = await listVocab("folders", { limit: 100 });
          if (cancelled) return;
          setSuggestions(response.items);
        } else {
          const response = await listVocab(vocab, { limit: 100 });
          if (cancelled) return;
          setSuggestions(response.items.map((item: VocabNamedItem) => ({ name: item.name })));
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vocab]);

  function addTag(raw: string, nextKind?: FolderKind) {
    const name = canAddTag(props.values, raw);
    if (!name) return;
    if (withKind) {
      const existing = suggestions.find((item) => item.name.toLowerCase() === name.toLowerCase());
      const resolvedKind: FolderKind =
        nextKind ??
        (existing?.kind === "folder" || existing?.kind === "playlist" ? existing.kind : kind);
      props.onChange([...props.values, { name: existing?.name ?? name, kind: resolvedKind }]);
    } else {
      props.onChange([...props.values, { name }]);
    }
    setDraft("");
  }

  const visibleSuggestions = filterTagSuggestions(
    suggestions,
    props.values,
    draft,
    SUGGESTION_LIMIT,
  );

  return (
    <Field>
      <FieldLabel htmlFor={id}>{props.label}</FieldLabel>
      {props.hint ? <FieldDescription>{props.hint}</FieldDescription> : null}
      <div className={withKind ? "flex flex-col gap-2 sm:flex-row" : undefined}>
        <Input
          id={id}
          className={withKind ? "flex-1" : undefined}
          value={draft}
          placeholder={props.placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addTag(event.currentTarget.value);
          }}
        />
        {withKind ? (
          <Select
            id={kindId}
            className="w-full sm:w-40"
            value={kind}
            aria-label="Kind"
            required
            onChange={(event) => setKind(event.target.value as FolderKind)}
          >
            {FOLDER_KINDS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      {visibleSuggestions.length > 0 || props.values.length > 0 ? (
        <div className="flex flex-row flex-wrap items-center gap-1.5">
          {props.values.map((item) => (
            <Badge
              key={`selected-${item.name}`}
              variant={badgeVariant}
              className="w-fit gap-1 pr-1"
            >
              {item.name}
              {withKind && "kind" in item ? (
                <span className="text-muted-foreground">· {item.kind}</span>
              ) : null}
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-overlay"
                aria-label={`Remove ${item.name}`}
                onClick={() =>
                  withKind
                    ? props.onChange(props.values.filter((value) => value.name !== item.name))
                    : props.onChange(props.values.filter((value) => value.name !== item.name))
                }
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          {visibleSuggestions.map((item, index) => (
            <button
              key={`suggest-${item.name}-${index}`}
              type="button"
              className="border-border bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs transition-colors"
              onClick={() =>
                addTag(
                  item.name,
                  item.kind === "folder" || item.kind === "playlist" ? item.kind : undefined,
                )
              }
            >
              {item.name}
              {withKind ? (
                <span className="text-muted-foreground/80">
                  {" "}
                  · {item.kind === "folder" || item.kind === "playlist" ? item.kind : "playlist"}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </Field>
  );
}
