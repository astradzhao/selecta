"use client";

import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";

import { Button } from "@selecta/ui/components/button";
import { Label } from "@selecta/ui/components/label";
import { Textarea } from "@selecta/ui/components/textarea";
import { cn } from "@selecta/ui/lib/utils";

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

type ExtractionProposalSummary = {
  id: string;
  proposalKey: string;
  status: string;
  sourceText: string | null;
  sourceStart: number | null;
  sourceEnd: number | null;
  confidence: string | null;
  bidirectional: boolean;
  ambiguities: string[];
  mentions: Array<{
    mentionId: string | null;
    mention: string | null;
    titleHint: string | null;
    artistHint: string | null;
    resolutionStatus: string | null;
    selectedCandidateId: string | null;
  }>;
  transition: {
    fromMentionId?: string;
    toMentionId?: string;
    fromBar?: number | null;
    toBar?: number | null;
    barsOverlap?: number | null;
    technique?: string | null;
    intent?: string | null;
    quality?: string | null;
    notes?: string | null;
  } | null;
  decision: string | null;
  committed: boolean;
  fromTrackId: string | null;
  toTrackId: string | null;
  commitError: string | null;
  error: string | null;
  reviewReasons: Array<{ code?: string; message?: string }> | null;
  attemptCount: number | null;
  model: string | null;
  promptVersion: string | null;
};

function proposalsFromNote(note: ApiNote): ExtractionProposalSummary[] {
  const extraction = note.extraction;
  if (!extraction || typeof extraction !== "object") return [];
  const proposals = (extraction as { proposals?: unknown }).proposals;
  if (!Array.isArray(proposals)) return [];

  return proposals.flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const p = raw as Record<string, unknown>;
    const mentions = Array.isArray(p.mentions)
      ? p.mentions.flatMap((m) => {
          if (!m || typeof m !== "object") return [];
          const mention = m as Record<string, unknown>;
          return [
            {
              mentionId: typeof mention.mentionId === "string" ? mention.mentionId : null,
              mention: typeof mention.mention === "string" ? mention.mention : null,
              titleHint: typeof mention.titleHint === "string" ? mention.titleHint : null,
              artistHint: typeof mention.artistHint === "string" ? mention.artistHint : null,
              resolutionStatus:
                typeof mention.resolutionStatus === "string" ? mention.resolutionStatus : null,
              selectedCandidateId:
                typeof mention.selectedCandidateId === "string"
                  ? mention.selectedCandidateId
                  : null,
            },
          ];
        })
      : [];
    const reviewReasons = Array.isArray(p.reviewReasons)
      ? p.reviewReasons.flatMap((reason) => {
          if (!reason || typeof reason !== "object") return [];
          const r = reason as { code?: unknown; message?: unknown };
          return [
            {
              code: typeof r.code === "string" ? r.code : undefined,
              message: typeof r.message === "string" ? r.message : undefined,
            },
          ];
        })
      : null;
    const transitionRaw =
      p.transition && typeof p.transition === "object"
        ? (p.transition as Record<string, unknown>)
        : null;
    const transition: ExtractionProposalSummary["transition"] = transitionRaw
      ? {
          fromMentionId:
            typeof transitionRaw.fromMentionId === "string"
              ? transitionRaw.fromMentionId
              : undefined,
          toMentionId:
            typeof transitionRaw.toMentionId === "string" ? transitionRaw.toMentionId : undefined,
          fromBar: typeof transitionRaw.fromBar === "number" ? transitionRaw.fromBar : null,
          toBar: typeof transitionRaw.toBar === "number" ? transitionRaw.toBar : null,
          barsOverlap:
            typeof transitionRaw.barsOverlap === "number" ? transitionRaw.barsOverlap : null,
          technique: typeof transitionRaw.technique === "string" ? transitionRaw.technique : null,
          intent: typeof transitionRaw.intent === "string" ? transitionRaw.intent : null,
          quality: typeof transitionRaw.quality === "string" ? transitionRaw.quality : null,
          notes: typeof transitionRaw.notes === "string" ? transitionRaw.notes : null,
        }
      : null;
    const ambiguities = Array.isArray(p.ambiguities)
      ? p.ambiguities.filter((item): item is string => typeof item === "string")
      : [];

    return [
      {
        id: typeof p.id === "string" ? p.id : `proposal-${index}`,
        proposalKey: typeof p.proposalKey === "string" ? p.proposalKey : `unknown-${index}`,
        status: typeof p.status === "string" ? p.status : "unknown",
        sourceText: typeof p.sourceText === "string" ? p.sourceText : null,
        sourceStart: typeof p.sourceStart === "number" ? p.sourceStart : null,
        sourceEnd: typeof p.sourceEnd === "number" ? p.sourceEnd : null,
        confidence: typeof p.confidence === "string" ? p.confidence : null,
        bidirectional: p.bidirectional === true,
        ambiguities,
        mentions,
        transition,
        decision: typeof p.decision === "string" ? p.decision : null,
        committed: p.committed === true,
        fromTrackId: typeof p.fromTrackId === "string" ? p.fromTrackId : null,
        toTrackId: typeof p.toTrackId === "string" ? p.toTrackId : null,
        commitError: typeof p.commitError === "string" ? p.commitError : null,
        error: typeof p.error === "string" ? p.error : null,
        reviewReasons,
        attemptCount: typeof p.attemptCount === "number" ? p.attemptCount : null,
        model: typeof p.model === "string" ? p.model : null,
        promptVersion: typeof p.promptVersion === "string" ? p.promptVersion : null,
      },
    ];
  });
}

function applySummaryFromNote(note: ApiNote): string | null {
  const extraction = note.extraction;
  if (!extraction || typeof extraction !== "object") return null;
  const summary = (extraction as { applySummary?: unknown }).applySummary;
  if (!summary || typeof summary !== "object") return null;
  const s = summary as { committed?: unknown; needsReview?: unknown; failed?: unknown };
  const committed = typeof s.committed === "number" ? s.committed : null;
  const needsReview = typeof s.needsReview === "number" ? s.needsReview : null;
  const failed = typeof s.failed === "number" ? s.failed : null;
  if (committed == null && needsReview == null && failed == null) return null;
  return `${committed ?? 0} committed · ${needsReview ?? 0} need review · ${failed ?? 0} failed`;
}

function mentionLabel(mention: ExtractionProposalSummary["mentions"][number]): string {
  if (mention.mention?.trim()) return mention.mention.trim();
  const hints = [mention.titleHint, mention.artistHint].filter(Boolean).join(" — ");
  return hints || mention.mentionId || "?";
}

function proposalStatusLabel(status: string): string {
  switch (status) {
    case "committed":
      return "Committed";
    case "needs_review":
      return "Needs review";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    case "superseded":
      return "Superseded";
    default:
      return status;
  }
}

function emptyMention(): ExtractionProposalSummary["mentions"][number] {
  return {
    mentionId: null,
    mention: null,
    titleHint: null,
    artistHint: null,
    resolutionStatus: null,
    selectedCandidateId: null,
  };
}

function transitionMetadataParts(
  transition: NonNullable<ExtractionProposalSummary["transition"]>,
): string[] {
  const parts: string[] = [];
  if (transition.fromBar != null || transition.toBar != null) {
    parts.push(`bars ${transition.fromBar ?? "—"} → ${transition.toBar ?? "—"}`);
  }
  if (transition.barsOverlap != null) {
    parts.push(`overlap ${transition.barsOverlap}`);
  }
  if (transition.technique?.trim()) {
    parts.push(`technique ${transition.technique.trim()}`);
  }
  if (transition.intent?.trim()) {
    parts.push(`intent ${transition.intent.trim()}`);
  }
  if (transition.quality?.trim()) {
    parts.push(`quality ${transition.quality.trim()}`);
  }
  return parts;
}

function ProposalCard({ proposal, index }: { proposal: ExtractionProposalSummary; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  const fromMention =
    proposal.mentions.find((m) => m.mentionId === proposal.transition?.fromMentionId) ??
    emptyMention();
  const toMention =
    proposal.mentions.find((m) => m.mentionId === proposal.transition?.toMentionId) ??
    emptyMention();
  const edgeLabel = proposal.transition
    ? `${mentionLabel(fromMention)} → ${mentionLabel(toMention)}`
    : null;
  const title = proposal.sourceText?.trim() || edgeLabel || `Proposal ${index + 1}`;
  const metadataParts = proposal.transition ? transitionMetadataParts(proposal.transition) : [];
  const transitionNotes = proposal.transition?.notes?.trim() || null;
  const hasIssues = Boolean(
    proposal.reviewReasons?.length ||
    proposal.error ||
    proposal.commitError ||
    proposal.ambiguities.length > 0,
  );

  return (
    <li className="border-border bg-background overflow-hidden rounded-md border">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
        className="hover:bg-muted/40 flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors"
      >
        <span
          className={cn(
            "text-muted-foreground mt-0.5 shrink-0 text-xs transition-transform duration-300",
            expanded && "rotate-90",
          )}
          aria-hidden
        >
          ▸
        </span>
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="text-muted-foreground flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
            <span className="text-foreground font-medium">
              #{index + 1} · {proposalStatusLabel(proposal.status)}
              {proposal.bidirectional ? " · bidirectional" : null}
            </span>
            {proposal.confidence ? <span>confidence {proposal.confidence}</span> : null}
            {proposal.decision ? <span>decision {proposal.decision}</span> : null}
          </span>
          <span className="block text-sm leading-snug text-pretty">{title}</span>
        </span>
      </button>

      <div
        id={panelId}
        inert={!expanded}
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "border-border space-y-2 border-t px-3 py-2.5 pl-7 transition-opacity duration-300",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
            {edgeLabel && edgeLabel !== title ? <p className="text-sm">{edgeLabel}</p> : null}

            {metadataParts.length > 0 ? (
              <p className="text-muted-foreground text-xs">{metadataParts.join(" · ")}</p>
            ) : null}
            {transitionNotes ? (
              <p className="text-muted-foreground text-xs">notes: {transitionNotes}</p>
            ) : null}

            {proposal.fromTrackId || proposal.toTrackId ? (
              <p className="text-muted-foreground font-mono text-xs">
                tracks {proposal.fromTrackId ?? "?"} → {proposal.toTrackId ?? "?"}
                {proposal.bidirectional ? " (+ reverse)" : null}
              </p>
            ) : null}

            {proposal.mentions.length > 0 ? (
              <ul className="text-muted-foreground space-y-0.5 text-xs">
                {proposal.mentions.map((mention) => (
                  <li key={`${proposal.id}-${mention.mentionId ?? mention.mention}`}>
                    {mention.mentionId ?? "?"}: {mentionLabel(mention)}
                    {mention.resolutionStatus ? ` · ${mention.resolutionStatus}` : null}
                    {mention.selectedCandidateId ? ` · ${mention.selectedCandidateId}` : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {hasIssues ? (
              <ul className="space-y-1 text-xs">
                {proposal.reviewReasons?.map((reason, reasonIndex) =>
                  reason.message ? (
                    <li
                      key={`${proposal.id}-reason-${reasonIndex}`}
                      className="text-amber-700 dark:text-amber-400"
                    >
                      {reason.code ? `${reason.code}: ` : null}
                      {reason.message}
                    </li>
                  ) : null,
                )}
                {proposal.error ? (
                  <li className="text-red-700 dark:text-red-400" role="alert">
                    {proposal.error}
                  </li>
                ) : null}
                {proposal.commitError ? (
                  <li className="text-red-700 dark:text-red-400" role="alert">
                    commit: {proposal.commitError}
                  </li>
                ) : null}
                {proposal.ambiguities.map((ambiguity) => (
                  <li key={`${proposal.id}-amb-${ambiguity}`} className="text-muted-foreground">
                    note: {ambiguity}
                  </li>
                ))}
              </ul>
            ) : null}

            {(proposal.model || proposal.promptVersion || proposal.attemptCount != null) && (
              <p className="text-muted-foreground text-[11px]">
                {[
                  proposal.promptVersion ? `prompt ${proposal.promptVersion}` : null,
                  proposal.model,
                  proposal.attemptCount != null ? `parse attempts ${proposal.attemptCount}` : null,
                  proposal.sourceStart != null && proposal.sourceEnd != null
                    ? `chars ${proposal.sourceStart}–${proposal.sourceEnd}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function ExtractionDebug({ note }: { note: ApiNote }) {
  const proposals = proposalsFromNote(note);
  const summary = applySummaryFromNote(note);

  return (
    <section
      className="border-border bg-muted/30 space-y-4 rounded-lg border px-3 py-3"
      aria-live="polite"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">
          Extraction: {extractionStatusLabel(note.extractionStatus)}
          <span className="text-muted-foreground font-normal"> · v{note.extractionVersion}</span>
        </p>
        {summary ? <p className="text-muted-foreground text-sm">{summary}</p> : null}
        {note.extractionStatus === "failed" && note.extractionError ? (
          <p className="text-sm" role="alert">
            {note.extractionError}
          </p>
        ) : null}
        {(note.model || note.promptVersion) && (
          <p className="text-muted-foreground text-xs">
            {[note.model, note.promptVersion ? `prompt ${note.promptVersion}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {proposals.length > 0 ? (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Proposals ({proposals.length})
          </p>
          <ul className="space-y-2">
            {proposals.map((proposal, index) => (
              <ProposalCard key={proposal.id} proposal={proposal} index={index} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function NoteDetail({ noteId, readOnly = false }: { noteId: string; readOnly?: boolean }) {
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

  const listHref = readOnly ? "/library?view=submissions" : "/notes";
  const listLabel = readOnly ? "Submissions" : "Notes";
  const backLabel = readOnly ? "Back to submissions" : "Back to notes";
  const entityLabel = readOnly ? "submission" : "note";
  const EntityLabel = readOnly ? "Submission" : "Note";

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
              ? `The local ${entityLabel}s database isn’t running. Start the full stack with \`pnpm dev\`.`
              : err.message
            : `Failed to load ${entityLabel}.`,
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
    return <p className="text-muted-foreground text-sm">Loading {entityLabel}…</p>;
  }

  if (loadError || !note) {
    return (
      <div className="space-y-4">
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {loadError ?? `${EntityLabel} not found.`}
        </p>
        <Button asChild variant="outline">
          <Link href={listHref}>{backLabel}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="border-border space-y-2 border-b pb-6">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
          <Link href={listHref} className="hover:text-foreground transition-colors">
            {listLabel}
          </Link>
          {" / "}
          Detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {readOnly ? "Submission" : "Edit note"}
        </h1>
        <p className="text-muted-foreground text-sm">
          Created {formatTimestamp(note.createdAt)}
          {!readOnly && note.updatedAt !== note.createdAt
            ? ` · last edited ${formatTimestamp(note.updatedAt)}`
            : null}
        </p>
      </header>

      {readOnly ? (
        <div className="space-y-2">
          <Label htmlFor="submission-raw-text">Raw text</Label>
          <Textarea
            id="submission-raw-text"
            value={note.rawText}
            readOnly
            className="bg-muted/20 min-h-56"
          />
          <p className="text-muted-foreground text-xs">
            Submissions are immutable. Edit committed transitions or resolve review items instead.
          </p>
          <div className="pt-2">
            <Button asChild type="button" variant="outline">
              <Link href={listHref}>{backLabel}</Link>
            </Button>
          </div>
        </div>
      ) : (
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
            <p
              className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm"
              role="alert"
            >
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
              <Link href={listHref}>{backLabel}</Link>
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        <ExtractionDebug note={note} />
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
      </div>

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
