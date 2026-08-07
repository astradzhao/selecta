"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { Textarea } from "@selecta/ui/components/textarea";

import { ApiClientError } from "@/lib/api/client";
import {
  deleteTransition,
  getTransition,
  updateTransition,
  type ApiTransition,
} from "@/lib/transitions/api";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function artistLine(artists: Array<{ name: string }>): string {
  return artists.map((artist) => artist.name).join(", ") || "Unknown artist";
}

function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

type FormState = {
  fromBar: string;
  toBar: string;
  barsOverlap: string;
  technique: string;
  intent: string;
  quality: string;
  notes: string;
};

function formFromTransition(transition: ApiTransition): FormState {
  return {
    fromBar: transition.fromBar != null ? String(transition.fromBar) : "",
    toBar: transition.toBar != null ? String(transition.toBar) : "",
    barsOverlap: transition.barsOverlap != null ? String(transition.barsOverlap) : "",
    technique: transition.technique ?? "",
    intent: transition.intent ?? "",
    quality: transition.quality ?? "",
    notes: transition.notes ?? "",
  };
}

export function TransitionDetail({ transitionId }: { transitionId: string }) {
  const router = useRouter();
  const [transition, setTransition] = useState<ApiTransition | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getTransition(transitionId);
        if (cancelled) return;
        setTransition(response.transition);
        setForm(formFromTransition(response.transition));
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setTransition(null);
        setForm(null);
        setLoadError(
          err instanceof ApiClientError
            ? err.code === "graph_not_configured"
              ? "The local graph database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to load transition.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [transitionId]);

  const listHref = "/library?view=transitions";

  if (loading && !transition) {
    return <p className="text-muted-foreground text-sm">Loading transition…</p>;
  }

  if (loadError || !transition || !form) {
    return (
      <div className="space-y-4">
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {loadError ?? "Transition not found."}
        </p>
        <Button asChild variant="outline">
          <Link href={listHref}>Back to transitions</Link>
        </Button>
      </div>
    );
  }

  function onFieldChange(field: keyof FormState, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setSaveError(null);
    setSaveMessage(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !transition) return;

    const fromBar = optionalNumber(form.fromBar);
    const toBar = optionalNumber(form.toBar);
    const barsOverlap = optionalNumber(form.barsOverlap);
    if ([fromBar, toBar, barsOverlap].some((value) => Number.isNaN(value))) {
      setSaveError("Bar fields must be numbers when set.");
      setSaveMessage(null);
      return;
    }

    startSave(async () => {
      try {
        const response = await updateTransition(transition.id, {
          fromBar,
          toBar,
          barsOverlap,
          technique: form.technique.trim() || null,
          intent: form.intent.trim() || null,
          quality: form.quality.trim() || null,
          notes: form.notes.trim() || null,
        });
        setTransition(response.transition);
        setForm(formFromTransition(response.transition));
        setSaveError(null);
        setSaveMessage("Saved.");
      } catch (err) {
        setSaveMessage(null);
        setSaveError(err instanceof ApiClientError ? err.message : "Failed to save transition.");
      }
    });
  }

  function onDelete() {
    if (!transition) return;
    const confirmed = window.confirm(
      `Delete the transition from “${transition.fromTrack.title}” to “${transition.toTrack.title}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    startDelete(async () => {
      try {
        await deleteTransition(transition.id);
        router.push(listHref);
        router.refresh();
      } catch (err) {
        setDeleteError(
          err instanceof ApiClientError ? err.message : "Failed to delete transition.",
        );
      }
    });
  }

  return (
    <div className="space-y-10">
      <header className="border-border space-y-3 border-b pb-6">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
          <Link href={listHref} className="hover:text-foreground transition-colors">
            Transitions
          </Link>
          {" / "}
          Detail
        </p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {transition.fromTrack.title}
            <span className="text-muted-foreground font-normal"> → </span>
            {transition.toTrack.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {artistLine(transition.fromTrack.artists)}
            <span className="text-muted-foreground/70"> → </span>
            {artistLine(transition.toTrack.artists)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {transition.technique ? <Badge variant="secondary">{transition.technique}</Badge> : null}
          {transition.intent ? <Badge variant="outline">{transition.intent}</Badge> : null}
          {transition.quality ? <Badge variant="outline">{transition.quality}</Badge> : null}
          <span className="text-muted-foreground text-xs">
            Created {formatTimestamp(transition.createdAt)}
            {transition.updatedAt !== transition.createdAt
              ? ` · updated ${formatTimestamp(transition.updatedAt)}`
              : null}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/tracks/${transition.fromTrack.id}`}>From track</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/tracks/${transition.toTrack.id}`}>To track</Link>
          </Button>
          {transition.sourceNoteId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/library/submissions/${transition.sourceNoteId}`}>
                Source submission
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/graph?track=${encodeURIComponent(transition.fromTrack.id)}`}>
              Open in graph
            </Link>
          </Button>
        </div>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="transition-from-bar">From bar</Label>
            <Input
              id="transition-from-bar"
              inputMode="decimal"
              value={form.fromBar}
              onChange={(event) => onFieldChange("fromBar", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transition-to-bar">To bar</Label>
            <Input
              id="transition-to-bar"
              inputMode="decimal"
              value={form.toBar}
              onChange={(event) => onFieldChange("toBar", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transition-bars-overlap">Bars overlap</Label>
            <Input
              id="transition-bars-overlap"
              inputMode="decimal"
              value={form.barsOverlap}
              onChange={(event) => onFieldChange("barsOverlap", event.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="transition-technique">Technique</Label>
            <Input
              id="transition-technique"
              value={form.technique}
              onChange={(event) => onFieldChange("technique", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transition-intent">Intent</Label>
            <Input
              id="transition-intent"
              value={form.intent}
              onChange={(event) => onFieldChange("intent", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transition-quality">Quality</Label>
            <Input
              id="transition-quality"
              value={form.quality}
              onChange={(event) => onFieldChange("quality", event.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="transition-notes">Notes</Label>
          <Textarea
            id="transition-notes"
            value={form.notes}
            onChange={(event) => onFieldChange("notes", event.target.value)}
            className="min-h-28"
            disabled={saving}
          />
        </div>

        {saveError ? (
          <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm" role="alert">
            {saveError}
          </p>
        ) : null}
        {saveMessage ? (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {saveMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href={listHref}>Back to transitions</Link>
          </Button>
        </div>
      </form>

      <section className="border-border space-y-3 border-t pt-8">
        <h2 className="font-medium">Delete</h2>
        <p className="text-muted-foreground max-w-xl text-sm">
          Removes this committed transition edge from the graph. Source submissions stay intact.
        </p>
        {deleteError ? (
          <p className="text-sm" role="alert">
            {deleteError}
          </p>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? "Deleting…" : "Delete transition"}
        </Button>
      </section>
    </div>
  );
}
