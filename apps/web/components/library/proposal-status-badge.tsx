import { Badge } from "@selecta/ui/components/badge";

import type { ApiProposal } from "@/lib/proposals/types";

export function proposalStatusLabel(status: ApiProposal["status"]): string {
  switch (status) {
    case "needs_review":
      return "Needs review";
    case "failed":
      return "Failed";
    case "committed":
      return "Committed";
    case "rejected":
      return "Rejected";
    case "superseded":
      return "Superseded";
    case "queued":
    case "parsing":
    case "resolving":
    case "ready":
      return "Processing";
    default:
      return status;
  }
}

export function proposalStatusVariant(
  status: ApiProposal["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "needs_review" || status === "failed") return "destructive";
  if (status === "committed") return "secondary";
  if (status === "rejected") return "outline";
  return "outline";
}

export function ProposalStatusBadge({ status }: { status: ApiProposal["status"] }) {
  return <Badge variant={proposalStatusVariant(status)}>{proposalStatusLabel(status)}</Badge>;
}
