import type { NoteProposalStatus } from "@selecta/db";

import type { StatusDisplay } from "@/lib/status";

export const PROPOSAL_STATUS = {
  queued: { label: "Processing", tone: "info", inProgress: true },
  parsing: { label: "Processing", tone: "info", inProgress: true },
  resolving: { label: "Processing", tone: "info", inProgress: true },
  ready: { label: "Processing", tone: "info", inProgress: true },
  needs_review: { label: "Needs review", tone: "warning" },
  committed: { label: "Committed", tone: "success" },
  failed: { label: "Failed", tone: "destructive" },
  rejected: { label: "Rejected", tone: "neutral" },
  superseded: { label: "Superseded", tone: "neutral" },
} as const satisfies Record<NoteProposalStatus, StatusDisplay>;

export function proposalStatus(status: NoteProposalStatus): StatusDisplay {
  return PROPOSAL_STATUS[status];
}

export function proposalStatusLabel(status: NoteProposalStatus): string {
  return PROPOSAL_STATUS[status].label;
}
