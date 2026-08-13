import Link from "next/link";

import { ProposalStatusBadge } from "@/components/library/proposal-status-badge";
import type { ApiProposal } from "@/lib/proposals/types";

function transitionIdFromProposal(proposal: ApiProposal): string | null {
  const applied = proposal.policyResult?.applied;
  if (!applied || typeof applied !== "object") return null;
  const transitionId = (applied as { transitionId?: unknown }).transitionId;
  return typeof transitionId === "string" ? transitionId : null;
}

function previewText(proposal: ApiProposal): string {
  const text = proposal.sourceText.trim();
  if (!text) return "Empty span";
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

function siblingHref(noteId: string, proposal: ApiProposal): string {
  if (proposal.status === "needs_review" || proposal.status === "failed") {
    return `/library/submissions/${noteId}/proposals/${proposal.id}`;
  }
  if (proposal.status === "committed") {
    const transitionId = transitionIdFromProposal(proposal);
    if (transitionId) return `/library/transitions/${transitionId}`;
  }
  return `/library/submissions/${noteId}`;
}

export function ProposalSiblings({
  noteId,
  siblings,
  currentProposalId,
}: {
  noteId: string;
  siblings: ApiProposal[];
  currentProposalId: string;
}) {
  if (siblings.length <= 1) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Other proposals from this submission</h2>
      <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
        {siblings.map((proposal) => {
          const isCurrent = proposal.id === currentProposalId;
          const row = (
            <div className="flex items-start gap-3">
              <p className="line-clamp-2 min-w-0 flex-1 text-sm text-pretty">
                {previewText(proposal)}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <ProposalStatusBadge status={proposal.status} />
              </div>
            </div>
          );

          if (isCurrent) {
            return (
              <li key={proposal.id} className="bg-surface-2 px-4 py-3" aria-current="page">
                {row}
                <p className="text-muted-foreground mt-1 text-xs">Reviewing now</p>
              </li>
            );
          }

          return (
            <li key={proposal.id}>
              <Link
                href={siblingHref(noteId, proposal)}
                className="hover:bg-surface-2 block px-4 py-3 transition-colors"
              >
                {row}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export { transitionIdFromProposal };
