"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@selecta/ui/components/button";
import { Label } from "@selecta/ui/components/label";
import { Textarea } from "@selecta/ui/components/textarea";

import { NoteTrackLinks } from "@/components/notes/note-track-links";
import { ApiClientError } from "@/lib/api/client";
import {
  extractNote,
  getNote,
  updateNote,
  type ApiNote,
  type ApiNoteTrackLink,
  type NoteExtractionStatus,
} from "@/lib/notes/api";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function extractionStatusLabel(status: NoteExtractionStatus): string {
  switch (status) {
    case "extracting":
      return "Processing…";
    case "no_proposal":
      return "No graph proposal";
    case "resolving":
      return "Resolving tracks…";
    case "needs_review":
      return "Needs review";
    case "committed":
      return "Auto-committed";
    case "partially_committed":
      return "Partially committed";
    case "commit_failed":
      return "Commit failed";
    case "failed":
      return "Processing failed";
    case "idle":
    default:
      return "Not processed yet";
  }
}

function reviewReasonsFromNote(note: ApiNote): string[] {
  const extraction = note.extraction;
  if (!extraction || typeof extraction !== "object") return [];
  const record = extraction as {
    reviewReasons?: unknown;
    proposals?: unknown;
    applySummary?: { needsReview?: unknown; failed?: unknown; committed?: unknown };
  };
  const reasons: string[] = [];
  if (Array.isArray(record.reviewReasons)) {
    for (const reason of record.reviewReasons) {
      if (!reason || typeof reason !== "object") continue;
      const message = (reason as { message?: unknown }).message;
      if (typeof message === "string") reasons.push(message);
    }
  }
  if (Array.isArray(record.proposals)) {
    for (const proposal of record.proposals) {
      if (!proposal || typeof proposal !== "object") continue;
      const status = (proposal as { status?: unknown }).status;
      const error = (proposal as { error?: unknown }).error;
      if (status === "needs_review" || status === "failed") {
        if (typeof error === "string" && error) reasons.push(error);
        const reviewReasons = (proposal as { reviewReasons?: unknown }).reviewReasons;
        if (Array.isArray(reviewReasons)) {
          for (const reason of reviewReasons) {
            if (!reason || typeof reason !== "object") continue;
            const message = (reason as { message?: unknown }).message;
            if (typeof message === "string") reasons.push(message);
          }
        }
      }
    }
  }
  const summary = record.applySummary;
  if (summary && typeof summary === "object") {
    const committed = typeof summary.committed === "number" ? summary.committed : null;
    const needsReview = typeof summary.needsReview === "number" ? summary.needsReview : null;
    const failed = typeof summary.failed === "number" ? summary.failed : null;
    if (committed != null && (needsReview || failed)) {
      reasons.unshift(
        `Partial result: ${committed} committed, ${needsReview ?? 0} need review, ${failed ?? 0} failed.`,
      );
    }
  }
  return [...new Set(reasons)];
}

export function NoteDetail({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<ApiNote | null>(null);
  const [rawText, setRawText] = useState("");
  const [trackLinks, setTrackLinks] = useState<ApiNoteTrackLink[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getNote(noteId);
        if (cancelled) return;
        setNote(response.note);
        setRawText(response.note.rawText);
        setTrackLinks(response.note.trackLinks ?? []);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setNote(null);
        setLoadError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local notes database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to load note.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  useEffect(() => {
    if (note?.extractionStatus !== "extracting") return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void getNote(noteId)
        .then((response) => {
          if (cancelled) return;
          setNote(response.note);
          setTrackLinks(response.note.trackLinks ?? []);
        })
        .catch(() => {
          /* keep last known note; next poll may succeed */
        });
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [noteId, note?.extractionStatus]);

  const trimmed = rawText.trim();
  const dirty = note != null && rawText !== note.rawText;
  const canSave = dirty && trimmed.length > 0 && !saving;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note) return;
    if (!trimmed) {
      setSaveError("Write something before saving.");
      setSaveMessage(null);
      return;
    }

    startSave(async () => {
      try {
        const response = await updateNote(note.id, { rawText });
        setNote(response.note);
        setRawText(response.note.rawText);
        setTrackLinks(response.note.trackLinks ?? trackLinks);
        setSaveError(null);
        setRetryError(null);
        setSaveMessage("Saved — extraction started.");
      } catch (err) {
        setSaveMessage(null);
        setSaveError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local notes database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to save note. Is the API running?",
        );
      }
    });
  }

  function onRetryExtraction() {
    if (!note) return;
    startRetry(async () => {
      try {
        const response = await extractNote(note.id);
        setNote(response.note);
        setTrackLinks(response.note.trackLinks ?? trackLinks);
        setRetryError(null);
      } catch (err) {
        setRetryError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to retry extraction. Is the API running?",
        );
      }
    });
  }

  if (loading && !note) {
    return <p className="text-muted-foreground text-sm">Loading note…</p>;
  }

  if (loadError || !note) {
    return (
      <div className="space-y-4">
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {loadError ?? "Note not found."}
        </p>
        <Button asChild variant="outline">
          <Link href="/notes">Back to notes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="border-border space-y-2 border-b pb-6">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
          <Link href="/notes" className="hover:text-foreground transition-colors">
            Notes
          </Link>
          {" / "}
          Detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Edit note</h1>
        <p className="text-muted-foreground text-sm">
          Created {formatTimestamp(note.createdAt)}
          {note.updatedAt !== note.createdAt
            ? ` · last edited ${formatTimestamp(note.updatedAt)}`
            : null}
        </p>
      </header>

      <section
        className="border-border bg-muted/30 space-y-2 rounded-lg border px-3 py-3"
        aria-live="polite"
      >
        <p className="text-sm font-medium">
          Extraction: {extractionStatusLabel(note.extractionStatus)}
          <span className="text-muted-foreground font-normal"> · v{note.extractionVersion}</span>
        </p>
        {note.extractionStatus === "failed" && note.extractionError ? (
          <p className="text-sm" role="alert">
            {note.extractionError}
          </p>
        ) : null}
        {note.extractionStatus === "needs_review" ||
        note.extractionStatus === "partially_committed" ||
        note.extractionStatus === "commit_failed"
          ? reviewReasonsFromNote(note).map((reason) => (
              <p key={reason} className="text-muted-foreground text-sm">
                {reason}
              </p>
            ))
          : null}
        {note.extractionConfidence != null ? (
          <p className="text-muted-foreground text-xs">
            Confidence {note.extractionConfidence.toFixed(2)}
            {note.model ? ` · ${note.model}` : null}
            {note.promptVersion ? ` · prompt ${note.promptVersion}` : null}
          </p>
        ) : null}
        {retryError ? (
          <p className="text-sm" role="alert">
            {retryError}
          </p>
        ) : null}
        {note.extractionStatus === "failed" ||
        note.extractionStatus === "idle" ||
        note.extractionStatus === "needs_review" ||
        note.extractionStatus === "partially_committed" ||
        note.extractionStatus === "commit_failed" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={retrying}
            onClick={onRetryExtraction}
          >
            {retrying ? "Retrying…" : "Retry processing"}
          </Button>
        ) : null}
      </section>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="note-edit-raw-text">Note</Label>
          <Textarea
            id="note-edit-raw-text"
            value={rawText}
            onChange={(event) => {
              setRawText(event.target.value);
              setSaveError(null);
              setSaveMessage(null);
            }}
            className="min-h-56"
            aria-invalid={Boolean(saveError)}
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
          <Button type="submit" disabled={!canSave}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/notes">Back to notes</Link>
          </Button>
        </div>
      </form>

      <NoteTrackLinks
        noteId={note.id}
        initialLinks={trackLinks}
        onLinksChange={(next) => {
          setTrackLinks(next);
          setNote((current) => (current ? { ...current, trackLinks: next } : current));
        }}
      />
    </div>
  );
}
