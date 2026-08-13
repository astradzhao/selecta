"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { Label } from "@selecta/ui/components/label";
import { Separator } from "@selecta/ui/components/separator";

import { ProposalEndpointPicker } from "@/components/library/proposal-endpoint-picker";
import { ProposalSiblings } from "@/components/library/proposal-siblings";
import { ProposalSourceSpan } from "@/components/library/proposal-source-span";
import { ProposalStatusBadge } from "@/components/library/proposal-status-badge";
import {
  TransitionFields,
  emptyTransitionFields,
  parseTransitionFieldPatch,
  type TransitionFieldValues,
} from "@/components/tracks/transition-fields";
import { ApiClientError } from "@/lib/api/client";
import { invalidateLibraryCache } from "@/lib/library-cache";
import {
  approveProposal,
  getProposal,
  rejectProposal,
  reopenProposal,
  resolveProposal,
  type ApiProposal,
  type ApiProposalCandidate,
  type ApiProposalDetail,
  type ReviewerEndpointBody,
} from "@/lib/proposals/api";
import { gateReasonsForProposal } from "@/lib/proposals/gate-copy";
import { transitionIdFromProposal } from "@/components/library/proposal-siblings";

type ProposalMention = {
  mentionId?: string;
  mention?: string;
  titleHint?: string;
  artistHint?: string;
  selectedCandidateId?: string;
  candidates?: ApiProposalCandidate[];
};

function getTransitionMentionIds(proposal: ApiProposal): {
  fromMentionId: string | null;
  toMentionId: string | null;
} {
  const draftTransition = proposal.draft?.transition;
  if (draftTransition && typeof draftTransition === "object") {
    const transition = draftTransition as Record<string, unknown>;
    return {
      fromMentionId: typeof transition.fromMentionId === "string" ? transition.fromMentionId : null,
      toMentionId: typeof transition.toMentionId === "string" ? transition.toMentionId : null,
    };
  }

  const plan = proposal.resolution?.plan;
  if (plan && typeof plan === "object") {
    const transitions = (plan as Record<string, unknown>).transitions;
    if (Array.isArray(transitions) && transitions[0] && typeof transitions[0] === "object") {
      const transition = transitions[0] as Record<string, unknown>;
      return {
        fromMentionId:
          typeof transition.fromMentionId === "string" ? transition.fromMentionId : null,
        toMentionId: typeof transition.toMentionId === "string" ? transition.toMentionId : null,
      };
    }
  }

  return { fromMentionId: null, toMentionId: null };
}

function findMention(proposal: ApiProposal, mentionId: string | null): ProposalMention | null {
  if (!mentionId) return null;
  return (proposal.mentions as ProposalMention[]).find((m) => m.mentionId === mentionId) ?? null;
}

function endpointFromCandidate(
  candidate: NonNullable<ProposalMention["candidates"]>[number],
): ReviewerEndpointBody | null {
  if (candidate.trackId || candidate.track?.id) {
    return { kind: "track", trackId: candidate.trackId ?? candidate.track!.id };
  }
  if (candidate.providerId) {
    return {
      kind: "spotify",
      providerId: candidate.providerId,
      title: candidate.title,
      artists: candidate.artists,
      artworkUrl: candidate.artworkUrl ?? null,
      durationMs: candidate.durationMs ?? null,
    };
  }
  return null;
}

function endpointFromReviewState(
  reviewState: Record<string, unknown> | null,
  field: "from" | "to",
): ReviewerEndpointBody | null {
  if (!reviewState) return null;
  const raw = reviewState[field];
  if (!raw || typeof raw !== "object") return null;
  const endpoint = raw as Record<string, unknown>;
  if (endpoint.kind === "track" && typeof endpoint.trackId === "string") {
    return { kind: "track", trackId: endpoint.trackId };
  }
  if (
    endpoint.kind === "spotify" &&
    typeof endpoint.providerId === "string" &&
    typeof endpoint.title === "string" &&
    Array.isArray(endpoint.artists)
  ) {
    return {
      kind: "spotify",
      providerId: endpoint.providerId,
      title: endpoint.title,
      artists: endpoint.artists.map(String),
      artworkUrl: typeof endpoint.artworkUrl === "string" ? endpoint.artworkUrl : null,
      durationMs:
        typeof endpoint.durationMs === "number" && Number.isFinite(endpoint.durationMs)
          ? endpoint.durationMs
          : null,
    };
  }
  return null;
}

function prefillEndpoint(
  mention: ProposalMention | null,
  reviewState: Record<string, unknown> | null,
  field: "from" | "to",
  committedTrack: ApiProposal["fromTrack"],
): ReviewerEndpointBody | null {
  const saved = endpointFromReviewState(reviewState, field);
  if (saved) return saved;
  if (committedTrack) return { kind: "track", trackId: committedTrack.id };
  if (!mention) return null;
  const selected =
    mention.candidates?.find((candidate) => candidate.handle === mention.selectedCandidateId) ??
    mention.candidates?.[0];
  return selected ? endpointFromCandidate(selected) : null;
}

function transitionFieldsFromProposal(proposal: ApiProposal): {
  fields: TransitionFieldValues;
  bidirectional: boolean;
} {
  const draftTransition = proposal.draft?.transition;
  const plan = proposal.resolution?.plan;
  let source: Record<string, unknown> | null = null;
  if (draftTransition && typeof draftTransition === "object") {
    source = draftTransition as Record<string, unknown>;
  } else if (plan && typeof plan === "object") {
    const transitions = (plan as Record<string, unknown>).transitions;
    if (Array.isArray(transitions) && transitions[0] && typeof transitions[0] === "object") {
      source = transitions[0] as Record<string, unknown>;
    }
  }

  const bidirectional = proposal.draft?.bidirectional === true;
  if (!source) {
    return { fields: emptyTransitionFields(), bidirectional };
  }

  return {
    bidirectional,
    fields: {
      fromBar: source.fromBar != null ? String(source.fromBar) : "",
      toBar: source.toBar != null ? String(source.toBar) : "",
      barsOverlap: source.barsOverlap != null ? String(source.barsOverlap) : "",
      technique: typeof source.technique === "string" ? source.technique : "",
      intent: typeof source.intent === "string" ? source.intent : "",
      quality: typeof source.quality === "string" ? source.quality : "",
      notes: typeof source.notes === "string" ? source.notes : "",
    },
  };
}

function mentionLabel(mention: ProposalMention | null): string | null {
  const candidates = [mention?.titleHint, mention?.mention].filter((part): part is string =>
    Boolean(part?.trim()),
  );
  return candidates[0]?.trim() ?? null;
}

/** Title the proposal by the transition it describes, not by the raw span text. */
function titleFromProposal(
  proposal: ApiProposal,
  fromMention: ProposalMention | null,
  toMention: ProposalMention | null,
): string {
  const from = proposal.fromTrack?.title ?? mentionLabel(fromMention);
  const to = proposal.toTrack?.title ?? mentionLabel(toMention);
  if (from && to) return `${from} → ${to}`;
  if (from) return `${from} → ?`;
  if (to) return `? → ${to}`;
  const text = proposal.sourceText.trim();
  if (!text) return "Unreadable proposal";
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

type ReviewAction = "approve" | "reject" | "resolve" | "reopen";

function isReviewable(status: ApiProposal["status"]): boolean {
  return status === "needs_review" || status === "failed";
}

function isReadOnly(status: ApiProposal["status"]): boolean {
  return status === "committed" || status === "rejected" || status === "superseded";
}

export function ProposalReview({ noteId, proposalId }: { noteId: string; proposalId: string }) {
  const router = useRouter();
  const fieldId = useId();
  const [detail, setDetail] = useState<ApiProposalDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [fromEndpoint, setFromEndpoint] = useState<ReviewerEndpointBody | null>(null);
  const [toEndpoint, setToEndpoint] = useState<ReviewerEndpointBody | null>(null);
  const [fields, setFields] = useState<TransitionFieldValues>(emptyTransitionFields());
  const [bidirectional, setBidirectional] = useState(false);
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [loading, startLoad] = useTransition();
  const [acting, startAct] = useTransition();

  const submissionHref = `/library/submissions/${noteId}`;

  function applyDetail(next: ApiProposalDetail) {
    setDetail(next);
    const { fromMentionId, toMentionId } = getTransitionMentionIds(next.proposal);
    const fromMention = findMention(next.proposal, fromMentionId);
    const toMention = findMention(next.proposal, toMentionId);
    setFromEndpoint(
      prefillEndpoint(fromMention, next.proposal.reviewState, "from", next.proposal.fromTrack),
    );
    setToEndpoint(
      prefillEndpoint(toMention, next.proposal.reviewState, "to", next.proposal.toTrack),
    );
    const transition = transitionFieldsFromProposal(next.proposal);
    setFields(transition.fields);
    setBidirectional(transition.bidirectional);
  }

  async function reloadDetail() {
    const response = await getProposal(proposalId);
    applyDetail({
      proposal: response.proposal,
      note: response.note,
      siblings: response.siblings,
      commit: response.commit,
    });
    setLoadError(null);
    setConflictMessage(null);
  }

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getProposal(proposalId);
        if (cancelled) return;
        applyDetail({
          proposal: response.proposal,
          note: response.note,
          siblings: response.siblings,
          commit: response.commit,
        });
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setDetail(null);
        setLoadError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to load proposal.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [proposalId]);

  const proposal = detail?.proposal ?? null;
  const note = detail?.note ?? null;
  const siblings = detail?.siblings ?? [];

  const reviewQueue = useMemo(
    () => siblings.filter((sibling) => isReviewable(sibling.status)),
    [siblings],
  );
  const queueIndex = reviewQueue.findIndex((item) => item.id === proposalId);
  const nextInQueue = reviewQueue.find((item) => item.id !== proposalId) ?? null;

  const readOnly = proposal ? isReadOnly(proposal.status) : false;
  const canApprove = proposal ? isReviewable(proposal.status) : false;
  const canResolve = proposal?.status === "needs_review";
  const canReopen = proposal?.status === "rejected";
  const canReject = proposal ? isReviewable(proposal.status) : false;
  const approveDisabled = !fromEndpoint || !toEndpoint || acting || readOnly;

  const siblingDimSpans = useMemo(() => {
    if (!proposal || !note) return [];
    return siblings
      .filter((sibling) => sibling.id !== proposal.id && isReviewable(sibling.status))
      .map((sibling) => ({
        start: sibling.sourceStart,
        end: sibling.sourceEnd,
        sourceText: sibling.sourceText,
      }));
  }, [proposal, note, siblings]);

  const gateLines = proposal ? gateReasonsForProposal(proposal) : [];
  const committedTransitionId = proposal ? transitionIdFromProposal(proposal) : null;

  function onFieldChange(field: keyof TransitionFieldValues, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setActionError(null);
  }

  function handleConflict(err: unknown) {
    setPendingAction(null);
    if (err instanceof ApiClientError && err.status === 409) {
      setConflictMessage(err.message || "This proposal changed elsewhere. Reload to continue.");
      return;
    }
    setActionError(err instanceof ApiClientError ? err.message : "Action failed.");
  }

  /** Reviewing is a queue: once an item is decided, land on the next one that needs a human. */
  function advanceAfterDecision() {
    invalidateLibraryCache();
    router.push(
      nextInQueue ? `/library/submissions/${noteId}/proposals/${nextInQueue.id}` : submissionHref,
    );
    router.refresh();
  }

  function onApprove() {
    if (!proposal || !fromEndpoint || !toEndpoint) return;
    const parsed = parseTransitionFieldPatch(fields);
    if (!parsed.ok) {
      setActionError(parsed.error);
      return;
    }

    setPendingAction("approve");
    startAct(async () => {
      try {
        await approveProposal(proposal.id, {
          expectedUpdatedAt: proposal.updatedAt,
          from: fromEndpoint,
          to: toEndpoint,
          bidirectional,
          transition: parsed.patch,
        });
        setActionError(null);
        advanceAfterDecision();
      } catch (err) {
        handleConflict(err);
      }
    });
  }

  // No confirm dialog: rejecting writes nothing to the library and is undone with "Reopen".
  function onReject() {
    if (!proposal) return;
    setPendingAction("reject");
    startAct(async () => {
      try {
        await rejectProposal(proposal.id, { expectedUpdatedAt: proposal.updatedAt });
        setActionError(null);
        advanceAfterDecision();
      } catch (err) {
        handleConflict(err);
      }
    });
  }

  function onResolve() {
    if (!proposal) return;
    setPendingAction("resolve");
    startAct(async () => {
      try {
        const response = await resolveProposal(proposal.id);
        invalidateLibraryCache();
        const committed = response.transition?.id ?? transitionIdFromProposal(response.proposal);
        if (committed) {
          advanceAfterDecision();
          return;
        }
        await reloadDetail();
        setPendingAction(null);
        setActionError(
          "The automatic matcher still isn’t confident. Pick both tracks below and approve.",
        );
      } catch (err) {
        handleConflict(err);
      }
    });
  }

  function onReopen() {
    if (!proposal) return;
    setPendingAction("reopen");
    startAct(async () => {
      try {
        await reopenProposal(proposal.id, { expectedUpdatedAt: proposal.updatedAt });
        await reloadDetail();
        setPendingAction(null);
      } catch (err) {
        handleConflict(err);
      }
    });
  }

  if (loading && !proposal) {
    return <p className="text-muted-foreground text-sm">Loading proposal…</p>;
  }

  if (loadError || !proposal || !note) {
    return (
      <div className="space-y-4">
        <p className="border-border bg-surface-2 rounded-lg border px-3 py-2 text-sm">
          {loadError ?? "Proposal not found."}
        </p>
        <Button asChild variant="outline">
          <Link href={submissionHref}>Back to submission</Link>
        </Button>
      </div>
    );
  }

  const { fromMentionId, toMentionId } = getTransitionMentionIds(proposal);
  const fromMention = findMention(proposal, fromMentionId);
  const toMention = findMention(proposal, toMentionId);

  const queueLabel =
    reviewQueue.length > 1 && queueIndex >= 0
      ? `${queueIndex + 1} of ${reviewQueue.length} needing review`
      : null;
  const missingEndpoints = !fromEndpoint || !toEndpoint;
  const statusNotice = readOnlyNotice(proposal.status);

  return (
    <div className="space-y-10">
      <header className="space-y-5">
        <Link
          href={submissionHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Submission
        </Link>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <ProposalStatusBadge status={proposal.status} />
            {queueLabel ? (
              <span className="text-muted-foreground text-sm">{queueLabel}</span>
            ) : null}
          </div>
          <h1 className="text-page-title text-balance">
            {titleFromProposal(proposal, fromMention, toMention)}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {canApprove ? (
            <Button type="button" size="sm" disabled={approveDisabled} onClick={onApprove}>
              {pendingAction === "approve" ? "Approving…" : "Approve & commit"}
            </Button>
          ) : null}
          {canReject ? (
            <Button type="button" size="sm" variant="outline" disabled={acting} onClick={onReject}>
              {pendingAction === "reject" ? "Rejecting…" : "Reject"}
            </Button>
          ) : null}
          {canResolve ? (
            <Button type="button" size="sm" variant="ghost" disabled={acting} onClick={onResolve}>
              {pendingAction === "resolve" ? "Retrying…" : "Retry auto-match"}
            </Button>
          ) : null}
          {canReopen ? (
            <Button type="button" size="sm" variant="outline" disabled={acting} onClick={onReopen}>
              {pendingAction === "reopen" ? "Reopening…" : "Reopen for review"}
            </Button>
          ) : null}
          {proposal.status === "committed" && committedTransitionId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/library/transitions/${committedTransitionId}`}>Open transition</Link>
            </Button>
          ) : null}
          {canApprove && missingEndpoints ? (
            <p className="text-caption">Pick a track on both sides to approve.</p>
          ) : null}
        </div>
      </header>

      {conflictMessage ? (
        <div className="border-border bg-surface-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
          <span>{conflictMessage}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void reloadDetail()}>
            Reload
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <p
          className="border-destructive/40 bg-destructive-subtle text-destructive rounded-lg border px-4 py-3 text-sm"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      {statusNotice ? (
        <p className="border-border bg-surface-2 text-muted-foreground rounded-lg border px-4 py-3 text-sm">
          {statusNotice}
        </p>
      ) : null}

      {proposal.status === "failed" ? (
        <div className="border-destructive/40 bg-destructive-subtle space-y-1 rounded-lg border px-4 py-3">
          <p className="text-card-title">Extraction failed for this span</p>
          <p className="text-muted-foreground text-sm">
            {proposal.error ?? "No error detail was recorded."} You can still fill it in by hand
            below.
          </p>
        </div>
      ) : null}

      {gateLines.length > 0 && !readOnly ? (
        <section className="border-border bg-surface-1 space-y-2 rounded-lg border px-4 py-3">
          <h2 className="text-eyebrow">Why this needs review</h2>
          <ul className="text-muted-foreground space-y-1 text-sm">
            {gateLines.map((line, index) => (
              <li key={`${line}-${index}`} className="flex gap-2">
                <span aria-hidden>—</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeading
          title="Source"
          hint="The highlighted span is what this proposal came from. Dimmed spans are other proposals in this submission."
        />
        <ProposalSourceSpan
          rawText={note.rawText}
          sourceStart={proposal.sourceStart}
          sourceEnd={proposal.sourceEnd}
          sourceText={proposal.sourceText}
          siblingSpans={siblingDimSpans}
        />
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Tracks"
          hint={readOnly ? undefined : "Confirm which track each side of the transition refers to."}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <ProposalEndpointPicker
            label="From"
            mention={fromMention}
            value={fromEndpoint}
            onChange={setFromEndpoint}
            disabled={readOnly || acting}
            readOnly={readOnly}
          />
          <ProposalEndpointPicker
            label="To"
            mention={toMention}
            value={toEndpoint}
            onChange={setToEndpoint}
            disabled={readOnly || acting}
            readOnly={readOnly}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Transition details"
          hint={readOnly ? undefined : "Everything here is optional."}
        />
        <TransitionFields
          idPrefix={fieldId}
          values={fields}
          onChange={onFieldChange}
          disabled={readOnly || acting}
        />
        <div className="flex items-center gap-2">
          <input
            id={`${fieldId}-bidirectional`}
            type="checkbox"
            className="size-4 rounded border"
            checked={bidirectional}
            disabled={readOnly || acting}
            onChange={(event) => setBidirectional(event.target.checked)}
          />
          <Label htmlFor={`${fieldId}-bidirectional`} className="font-normal">
            Works in both directions
          </Label>
        </div>
      </section>

      {siblings.length > 1 ? (
        <>
          <Separator />
          <ProposalSiblings noteId={noteId} siblings={siblings} currentProposalId={proposalId} />
        </>
      ) : null}

      <details className="border-border rounded-lg border px-4 py-3">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors">
          Extraction details
        </summary>
        <dl className="text-muted-foreground mt-4 text-numeric grid gap-x-6 gap-y-2 text-xs break-all sm:grid-cols-[10rem_minmax(0,1fr)]">
          <AuditRow label="proposal id" value={proposal.id} />
          <AuditRow label="proposal key" value={proposal.proposalKey} />
          <AuditRow label="fingerprint" value={proposal.sourceFingerprint} />
          <AuditRow label="attempts" value={String(proposal.attemptCount)} />
          <AuditRow label="model" value={proposal.model ?? "—"} />
          <AuditRow label="prompt" value={proposal.promptVersion ?? "—"} />
          <AuditRow label="created" value={proposal.createdAt} />
          <AuditRow label="updated" value={proposal.updatedAt} />
          {detail?.commit ? (
            <>
              <AuditRow label="commit id" value={detail.commit.id} />
              <AuditRow label="commit status" value={detail.commit.status} />
              {detail.commit.error ? (
                <AuditRow label="commit error" value={detail.commit.error} />
              ) : null}
            </>
          ) : null}
        </dl>
        <pre className="bg-surface-1 text-muted-foreground mt-4 text-numeric overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
          {JSON.stringify(proposal.raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-section-title">{title}</h2>
      {hint ? <p className="text-caption">{hint}</p> : null}
    </div>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="text-foreground/80">{value}</dd>
    </>
  );
}

function readOnlyNotice(status: ApiProposal["status"]): string | null {
  switch (status) {
    case "committed":
      return "Committed to the library. Edit the transition itself to make further changes.";
    case "rejected":
      return "Rejected — nothing was written to the library. Reopen it to review again.";
    case "superseded":
      return "A newer extraction replaced this proposal. Open the submission to review the current version.";
    default:
      return null;
  }
}
