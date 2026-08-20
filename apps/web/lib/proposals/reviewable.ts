import type { ApiProposal } from "./types";

export function isReviewable(status: ApiProposal["status"]): boolean {
  return status === "needs_review" || status === "failed";
}
