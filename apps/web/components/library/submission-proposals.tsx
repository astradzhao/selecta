"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@selecta/ui/components/button";
import { StatePanel } from "@selecta/ui/components/state-panel";

import { ProposalSourceSpan } from "@/components/library/proposal-source-span";
import { ProposalStatusBadge } from "@/components/library/proposal-status-badge";
import { transitionIdFromProposal } from "@/components/library/proposal-siblings";
import { ApiClientError } from "@/lib/api/client";
import { listNoteProposals, type ApiProposal } from "@/lib/proposals/api";

const GROUP_ORDER: Array<{ key: string; label: string; statuses: ApiProposal["status"][] }> = [
  { key: "needs_review", label: "Needs review", statuses: ["needs_review"] },
  { key: "failed", label: "Failed", statuses: ["failed"] },
  { key: "committed", label: "Committed", statuses: ["committed"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
];

function previewText(proposal: ApiProposal): string {
  const text = proposal.sourceText.trim();
  if (!text) return "Empty span";
  return text.length > 100 ? `${text.slice(0, 97)}…` : text;
}

function isReviewable(proposal: ApiProposal): boolean {
  return proposal.status === "needs_review" || proposal.status === "failed";
}

export function SubmissionProposals({ noteId, rawText }: { noteId: string; rawText: string }) {
  const [proposals, setProposals] = useState<ApiProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listNoteProposals(noteId);
        if (cancelled) return;
        setProposals(response.proposals.filter((proposal) => proposal.status !== "superseded"));
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setProposals([]);
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to load proposals for this submission.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      ...group,
      items: proposals.filter((proposal) => group.statuses.includes(proposal.status)),
    })).filter((group) => group.items.length > 0);
  }, [proposals]);

  const highlightSpans = useMemo(
    () =>
      proposals
        .filter((proposal) => proposal.status === "needs_review")
        .map((proposal) => ({
          start: proposal.sourceStart,
          end: proposal.sourceEnd,
          sourceText: proposal.sourceText,
        })),
    [proposals],
  );

  if (loading) {
    return <StatePanel variant="loading">Loading proposals…</StatePanel>;
  }

  if (error) {
    return <StatePanel variant="error" title="Proposals unavailable" description={error} />;
  }

  if (proposals.length === 0) {
    return <StatePanel variant="empty" title="No proposals for this submission yet." />;
  }

  return (
    <div className="space-y-6">
      {highlightSpans.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-eyebrow">Spans needing review</h3>
          <ProposalSourceSpan
            rawText={rawText}
            sourceStart={highlightSpans[0]!.start}
            sourceEnd={highlightSpans[0]!.end}
            sourceText={highlightSpans[0]!.sourceText}
            siblingSpans={highlightSpans.slice(1)}
          />
        </section>
      ) : null}

      {grouped.map((group) => (
        <section key={group.key} className="space-y-2">
          <h3 className="text-eyebrow">
            {group.label} ({group.items.length})
          </h3>
          <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {group.items.map((proposal) => {
              const transitionId = transitionIdFromProposal(proposal);
              return (
                <li
                  key={proposal.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <p className="line-clamp-2 text-sm text-pretty">{previewText(proposal)}</p>
                    <ProposalStatusBadge status={proposal.status} />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {isReviewable(proposal) ? (
                      <Button asChild size="sm">
                        <Link href={`/library/submissions/${noteId}/proposals/${proposal.id}`}>
                          Review
                        </Link>
                      </Button>
                    ) : null}
                    {proposal.status === "committed" && transitionId ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/library/transitions/${transitionId}`}>Open transition</Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
