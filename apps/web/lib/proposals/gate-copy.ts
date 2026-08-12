import type { ApiProposal, ApiProposalReviewReason } from "./types";

export type ProposalMention = {
  mentionId?: string;
  mention?: string;
  titleHint?: string;
  artistHint?: string;
  resolutionStatus?: string;
  selectedCandidateId?: string;
  candidates?: unknown[];
};

function mentionLabel(mention: ProposalMention | undefined): string {
  if (!mention) return "this mention";
  if (mention.mention?.trim()) return mention.mention.trim();
  const hints = [mention.titleHint, mention.artistHint].filter(Boolean).join(" — ");
  return hints || mention.mentionId || "this mention";
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Human-readable copy for persisted review gate codes. */
export function gateReasonCopy(reason: ApiProposalReviewReason, proposal: ApiProposal): string {
  const mentions = proposal.mentions as ProposalMention[];
  const firstMention = mentions[0];

  switch (reason.code) {
    case "low_confidence": {
      const confidence =
        typeof proposal.draft?.confidence === "string" ? proposal.draft.confidence : "moderate";
      return `The parser wasn't confident about this transition (\`${confidence}\`, needs \`strong\`).`;
    }
    case "unresolved_endpoint":
      return `No catalog match for “${mentionLabel(firstMention)}”. Pick a track below.`;
    case "ambiguous_match":
      return `Several tracks matched “${mentionLabel(firstMention)}” closely.`;
    case "invented_candidate":
      return "The parser referenced a track that wasn't in the search results.";
    case "too_many_imports": {
      const policy = proposal.policyResult;
      const max =
        readNumber(
          typeof policy === "object" && policy !== null
            ? (policy as { maxImports?: unknown }).maxImports
            : null,
        ) ?? 2;
      const n =
        readNumber(
          typeof policy === "object" && policy !== null
            ? (policy as { importCount?: unknown }).importCount
            : null,
        ) ?? max;
      return `This would add ${n} new tracks to your library (max ${max}).`;
    }
    case "incomplete_transition":
      return "The draft didn't say which two tracks the transition is between.";
    case "missing_required_fields":
    case "stale_version":
      return reason.message.trim() || reason.code;
    default:
      return reason.message.trim() || reason.code;
  }
}

export function gateReasonsForProposal(proposal: ApiProposal): string[] {
  const lines = proposal.reviewReasons.map((reason) => gateReasonCopy(reason, proposal));
  if (proposal.status === "failed" && proposal.error?.trim()) {
    lines.push(proposal.error.trim());
  }
  return lines;
}
