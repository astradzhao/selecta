"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { Label } from "@selecta/ui/components/label";
import { Textarea } from "@selecta/ui/components/textarea";

import { SubmissionProposals } from "@/components/library/submission-proposals";
import { SubmissionTrackLinks } from "@/components/library/submission-track-links";
import { ApiClientError } from "@/lib/api/client";
import {
  extractNote,
  getNote,
  type ApiNote,
  type ApiNoteTrackLink,
  type NoteExtractionStatus,
} from "@/lib/notes/api";

const LIST_HREF = "/library?view=submissions";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: NoteExtractionStatus): string {
  switch (status) {
    case "extracting":
      return "Processing";
    case "no_proposal":
      return "No proposal";
    case "resolving":
      return "Resolving";
    case "needs_review":
      return "Needs review";
    case "committed":
      return "Committed";
    case "partially_committed":
      return "Partial";
    case "commit_failed":
      return "Commit failed";
    case "failed":
      return "Failed";
    case "dismissed":
      return "Dismissed";
    case "idle":
    default:
      return "Idle";
  }
}

function canRetry(status: NoteExtractionStatus): boolean {
  return (
    status === "failed" ||
    status === "idle" ||
    status === "needs_review" ||
    status === "partially_committed" ||
    status === "commit_failed"
  );
}

function proposalCountsLine(note: ApiNote): string | null {
  const counts = note.proposalCounts;
  if (!counts) return null;
  return `${counts.committed} committed · ${counts.needsReview} need review · ${counts.failed} failed`;
}

export function SubmissionDetail({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<ApiNote | null>(null);
  const [trackLinks, setTrackLinks] = useState<ApiNoteTrackLink[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getNote(noteId);
        if (cancelled) return;
        setNote(response.note);
        setTrackLinks(response.note.trackLinks ?? []);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setNote(null);
        setLoadError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local submissions database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to load submission.",
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
    return <p className="text-muted-foreground text-sm">Loading submission…</p>;
  }

  if (loadError || !note) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">{loadError ?? "Submission not found."}</Alert>
        <Button asChild variant="outline">
          <Link href={LIST_HREF}>Back to submissions</Link>
        </Button>
      </div>
    );
  }

  const countsLine = proposalCountsLine(note);

  return (
    <div className="space-y-10">
      <header className="border-border space-y-2 border-b pb-6">
        <p className="text-eyebrow">
          <Link href={LIST_HREF} className="hover:text-foreground transition-colors">
            Submissions
          </Link>
          {" / "}
          Detail
        </p>
        <h1 className="text-page-title">Submission</h1>
        <p className="text-body text-muted-foreground text-numeric">
          Created {formatTimestamp(note.createdAt)}
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="submission-raw-text">Raw text</Label>
        <Textarea
          id="submission-raw-text"
          value={note.rawText}
          readOnly
          className="bg-surface-1 min-h-56"
        />
        <p className="text-caption">
          Submissions are immutable. Edit committed transitions or resolve review items instead.
        </p>
        <div className="pt-2">
          <Button asChild type="button" variant="outline">
            <Link href={LIST_HREF}>Back to submissions</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <section className="space-y-1" aria-live="polite">
          <p className="text-card-title">Extraction: {statusLabel(note.extractionStatus)}</p>
          {countsLine ? <p className="text-muted-foreground text-sm">{countsLine}</p> : null}
          {note.extractionStatus === "failed" && note.extractionError ? (
            <Alert variant="destructive">{note.extractionError}</Alert>
          ) : null}
        </section>
        <SubmissionProposals noteId={note.id} rawText={note.rawText} />
        {retryError ? <Alert variant="destructive">{retryError}</Alert> : null}
        {canRetry(note.extractionStatus) ? (
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
      </div>

      <SubmissionTrackLinks
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
