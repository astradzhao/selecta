"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, useTransition } from "react";

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

function titleFromProposal(proposal: ApiProposal): string {
  const text = proposal.sourceText.trim();
  if (!text) return "Proposal";
  return text.length > 72 ? `${text.slice(0, 69)}…` : text;
}

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
  const prevProposal = queueIndex > 0 ? reviewQueue[queueIndex - 1] : null;
  const nextProposal =
    queueIndex >= 0 && queueIndex < reviewQueue.length - 1 ? reviewQueue[queueIndex + 1] : null;

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
    if (err instanceof ApiClientError && err.status === 409) {
      setConflictMessage(err.message || "This proposal changed elsewhere. Reload to continue.");
      return;
    }
    setActionError(err instanceof ApiClientError ? err.message : "Action failed.");
  }

  function onApprove() {
    if (!proposal || !fromEndpoint || !toEndpoint) return;
    const parsed = parseTransitionFieldPatch(fields);
    if (!parsed.ok) {
      setActionError(parsed.error);
      return;
    }

    startAct(async () => {
      try {
        const response = await approveProposal(proposal.id, {
          expectedUpdatedAt: proposal.updatedAt,
          from: fromEndpoint,
          to: toEndpoint,
          bidirectional,
          transition: parsed.patch,
        });
        invalidateLibraryCache();
        const transitionId = response.transition?.id ?? transitionIdFromProposal(response.proposal);
        if (transitionId) {
          router.push(`/library/transitions/${transitionId}`);
          router.refresh();
          return;
        }
        await reloadDetail();
        setActionError(null);
      } catch (err) {
        handleConflict(err);
      }
    });
  }

  function onReject() {
    if (!proposal) return;
    const confirmed = window.confirm(
      "Reject this proposal? The submission text stays unchanged and nothing will be committed.",
    );
    if (!confirmed) return;

    startAct(async () => {
      try {
        await rejectProposal(proposal.id, { expectedUpdatedAt: proposal.updatedAt });
        await reloadDetail();
        setActionError(null);
      } catch (err) {
        handleConflict(err);
      }
    });
  }

  function onResolve() {
    if (!proposal) return;
    startAct(async () => {
      try {
        const response = await resolveProposal(proposal.id);
        invalidateLibraryCache();
        const transitionId = response.transition?.id ?? transitionIdFromProposal(response.proposal);
        if (transitionId) {
          router.push(`/library/transitions/${transitionId}`);
          router.refresh();
          return;
        }
        await reloadDetail();
      } catch (err) {
        handleConflict(err);
      }
    });
  }

  function onReopen() {
    if (!proposal) return;
    startAct(async () => {
      try {
        await reopenProposal(proposal.id, { expectedUpdatedAt: proposal.updatedAt });
        await reloadDetail();
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
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
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

  return (
    <div className="space-y-10">
      <header className="border-border space-y-4 border-b pb-6">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
          <Link href={submissionHref} className="hover:text-foreground transition-colors">
            Submission
          </Link>
          {" / "}
          Proposal
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Proposal</p>
            <div className="flex flex-wrap items-center gap-2">
              <ProposalStatusBadge status={proposal.status} />
              {reviewQueue.length > 1 && queueIndex >= 0 ? (
                <span className="text-muted-foreground text-sm">
                  Needs review {queueIndex + 1} of {reviewQueue.length}
                </span>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {titleFromProposal(proposal)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {prevProposal ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/library/submissions/${noteId}/proposals/${prevProposal.id}`}>
                  Previous
                </Link>
              </Button>
            ) : null}
            {nextProposal ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/library/submissions/${noteId}/proposals/${nextProposal.id}`}>
                  Next
                </Link>
              </Button>
            ) : null}
            {canApprove ? (
              <Button type="button" disabled={approveDisabled} onClick={onApprove}>
                {acting ? "Saving…" : "Approve"}
              </Button>
            ) : null}
            {canReject ? (
              <Button type="button" variant="outline" disabled={acting} onClick={onReject}>
                Reject
              </Button>
            ) : null}
            {canResolve ? (
              <Button type="button" variant="outline" disabled={acting} onClick={onResolve}>
                Resolve
              </Button>
            ) : null}
            {canReopen ? (
              <Button type="button" variant="outline" disabled={acting} onClick={onReopen}>
                Reopen
              </Button>
            ) : null}
            {proposal.status === "committed" && committedTransitionId ? (
              <Button asChild variant="outline">
                <Link href={`/library/transitions/${committedTransitionId}`}>Open transition</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {proposal.status === "superseded" ? (
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          This proposal was superseded by a newer extraction. Open the submission to review the
          current version.
        </p>
      ) : null}

      {conflictMessage ? (
        <div className="border-border bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
          <span>{conflictMessage}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void reloadDetail()}>
            Reload
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm" role="alert">
          {actionError}
        </p>
      ) : null}

      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          {proposal.status === "committed"
            ? "This proposal is committed. Transition details are read-only."
            : proposal.status === "rejected"
              ? "This proposal was rejected."
              : "This proposal is read-only."}
        </p>
      ) : null}

      {gateLines.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Why this needs review</h2>
          <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
            {gateLines.map((line, index) => (
              <li key={`${line}-${index}`} className="px-3 py-2 text-sm">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Source</h2>
        <ProposalSourceSpan
          rawText={note.rawText}
          sourceStart={proposal.sourceStart}
          sourceEnd={proposal.sourceEnd}
          sourceText={proposal.sourceText}
          siblingSpans={siblingDimSpans}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ProposalEndpointPicker
          label="From"
          mention={fromMention}
          value={fromEndpoint}
          onChange={setFromEndpoint}
          disabled={readOnly || acting}
        />
        <ProposalEndpointPicker
          label="To"
          mention={toMention}
          value={toEndpoint}
          onChange={setToEndpoint}
          disabled={readOnly || acting}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Transition fields</h2>
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
            Bidirectional
          </Label>
        </div>
      </section>

      <Separator />

      <ProposalSiblings noteId={noteId} siblings={siblings} currentProposalId={proposalId} />

      <details className="border-border rounded-lg border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Audit</summary>
        <div className="text-muted-foreground mt-3 space-y-2 font-mono text-xs break-all">
          <p>proposal id: {proposal.id}</p>
          <p>proposal key: {proposal.proposalKey}</p>
          <p>fingerprint: {proposal.sourceFingerprint}</p>
          <p>attempts: {proposal.attemptCount}</p>
          <p>model: {proposal.model ?? "—"}</p>
          <p>prompt: {proposal.promptVersion ?? "—"}</p>
          <p>created: {proposal.createdAt}</p>
          <p>updated: {proposal.updatedAt}</p>
          {detail?.commit ? (
            <>
              <p>commit id: {detail.commit.id}</p>
              <p>commit status: {detail.commit.status}</p>
              {detail.commit.error ? <p>commit error: {detail.commit.error}</p> : null}
            </>
          ) : null}
          <pre className="bg-muted/30 overflow-x-auto rounded-md p-2 whitespace-pre-wrap">
            {JSON.stringify(proposal.raw, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}
