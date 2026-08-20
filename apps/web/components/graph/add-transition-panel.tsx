"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";

import { omitFieldError } from "@/components/common/form-field";
import { TrackPicker } from "@/components/tracks/track-picker";
import { TrackRow } from "@/components/tracks/track-row";
import {
  emptyTransitionFields,
  parseTransitionFieldPatch,
  TransitionFields,
  type TransitionFieldErrors,
  type TransitionFieldValues,
} from "@/components/tracks/transition-fields";
import { describeApiError } from "@/lib/api/errors";
import type { ApiTrack } from "@/lib/tracks/api";
import { rowFromApiTrack } from "@/lib/tracks/track-row-item";
import { createTransition } from "@/lib/transitions/api";

export function AddTransitionPanel({
  fromTrackId,
  excludeTrackId,
  onCreated,
  onCancel,
}: {
  fromTrackId: string;
  excludeTrackId: string;
  onCreated: () => Promise<void>;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ApiTrack | null>(null);
  const [form, setForm] = useState<TransitionFieldValues>(emptyTransitionFields());
  const [fieldErrors, setFieldErrors] = useState<TransitionFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function onSubmit() {
    if (!selected) {
      setError("Pick a destination track from your library.");
      return;
    }
    const parsed = parseTransitionFieldPatch(form);
    if (!parsed.ok) {
      setFieldErrors(parsed.fields);
      setError(null);
      return;
    }
    startSave(async () => {
      try {
        await createTransition({
          fromTrackId,
          toTrackId: selected.id,
          ...parsed.patch,
        });
        setError(null);
        await onCreated();
      } catch (err) {
        setError(describeApiError(err, { fallback: "Failed to create transition." }));
      }
    });
  }

  return (
    <div className="border-border bg-surface-1 space-y-4 rounded-2xl border px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-card-title">Add transition</h3>
          <p className="text-muted-foreground text-xs text-pretty">
            Pick an existing library track. Missing a song?{" "}
            <Link href="/add" className="underline-offset-4 hover:underline">
              Add it first
            </Link>
            .
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <TrackRow item={rowFromApiTrack(selected)} size="sm" interaction="static" bare />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <TrackPicker
          source="library"
          query={query}
          onQueryChange={setQuery}
          excludeIds={[excludeTrackId]}
          limit={8}
          minQueryLength={1}
          size="sm"
          placeholder="Search library tracks"
          aria-label="Search library tracks"
          listClassName="max-h-40 overflow-y-auto"
          onSelect={(track) => {
            setSelected(track);
            setQuery("");
            setError(null);
          }}
        />
      )}

      <TransitionFields
        idPrefix="graph-add"
        values={form}
        errors={fieldErrors}
        compact
        disabled={saving}
        onChange={(field, value) => {
          setForm((current) => ({ ...current, [field]: value }));
          setFieldErrors((current) => omitFieldError(current, field));
          setError(null);
        }}
      />

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <Button type="button" disabled={saving || !selected} onClick={onSubmit}>
        {saving ? "Saving…" : "Create transition"}
      </Button>
    </div>
  );
}
