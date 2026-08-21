import type { ApiSubmission } from "./types";

/** Shared column geometry for the Library submissions header and each note row. */
export const CRATE_SUBMISSION_GRID =
  "grid grid-cols-[minmax(0,1fr)_8.5rem_3.5rem] items-center gap-3.5 px-3.5 sm:grid-cols-[minmax(0,1fr)_8.5rem_9.5rem_3.5rem]";

export type SubmissionRowInput = Pick<
  ApiSubmission,
  "extractionStatus" | "extractionError" | "extractionVersion" | "model" | "proposalCounts"
>;

export type SubmissionSubtitlePart = {
  text: string;
  tone?: "default" | "destructive";
};

/** Open review work floats above the chronological remainder of the page. */
export function submissionNeedsReview(submission: SubmissionRowInput): boolean {
  if ((submission.proposalCounts?.needsReview ?? 0) > 0) return true;
  return submission.extractionStatus === "needs_review";
}

export function partitionSubmissions<T extends SubmissionRowInput>(
  items: T[],
): { review: T[]; recent: T[] } {
  const review: T[] = [];
  const recent: T[] = [];
  for (const item of items) {
    if (submissionNeedsReview(item)) review.push(item);
    else recent.push(item);
  }
  return { review, recent };
}

function proposalCountLabel(total: number): string {
  return total === 1 ? "1 proposal" : `${total} proposals`;
}

function failedCountLabel(failed: number): string {
  return failed === 1 ? "1 commit failed" : `${failed} commits failed`;
}

/**
 * Second line of the crate row: the one fact that explains the current status,
 * rather than restating the badge.
 */
export function submissionSubtitle(submission: SubmissionRowInput): SubmissionSubtitlePart[] {
  const status = submission.extractionStatus;
  const counts = submission.proposalCounts;

  if (status === "extracting") return [{ text: "Extracting…" }];
  if (status === "resolving") return [{ text: "Resolving…" }];
  if (status === "dismissed") return [{ text: "Dismissed before extraction" }];
  if (status === "idle") return [{ text: "Waiting to extract" }];
  if (status === "no_proposal") return [{ text: "No transition found" }];

  if (status === "failed" || status === "commit_failed") {
    const error = submission.extractionError?.trim();
    return [{ text: error || "Extraction failed", tone: "destructive" }];
  }

  const parts: SubmissionSubtitlePart[] = [];
  if (counts && counts.total > 0) {
    parts.push({ text: proposalCountLabel(counts.total) });
  }
  if (counts && counts.failed > 0) {
    parts.push({ text: failedCountLabel(counts.failed), tone: "destructive" });
  }
  if (status === "committed") {
    if (submission.extractionVersion > 0) {
      parts.push({ text: `v${submission.extractionVersion}` });
    }
    const model = submission.model?.trim();
    if (model) parts.push({ text: model });
  }
  return parts;
}
