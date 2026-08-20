import type { SubmissionExtractionStatus } from "@selecta/db";

import type { StatusDisplay } from "@/lib/status";

export const EXTRACTION_STATUS = {
  idle: { label: "Idle", tone: "neutral" },
  extracting: { label: "Processing", tone: "info", inProgress: true },
  no_proposal: { label: "No proposal", tone: "neutral" },
  resolving: { label: "Resolving", tone: "info", inProgress: true },
  needs_review: { label: "Needs review", tone: "warning" },
  committed: { label: "Committed", tone: "success" },
  partially_committed: { label: "Partially committed", tone: "warning" },
  commit_failed: { label: "Commit failed", tone: "destructive" },
  failed: { label: "Failed", tone: "destructive" },
  dismissed: { label: "Dismissed", tone: "neutral" },
} as const satisfies Record<SubmissionExtractionStatus, StatusDisplay>;

const SUBMISSION_STATUS_FILTER_VALUES = [
  "needs_review",
  "partially_committed",
  "committed",
  "extracting",
  "failed",
  "dismissed",
  "commit_failed",
] as const satisfies readonly SubmissionExtractionStatus[];

export const SUBMISSION_STATUS_FILTER_OPTIONS: Array<{
  value: "" | SubmissionExtractionStatus;
  label: string;
}> = [
  { value: "", label: "Any status" },
  ...SUBMISSION_STATUS_FILTER_VALUES.map((value) => ({
    value,
    label: EXTRACTION_STATUS[value].label,
  })),
];

export function extractionStatus(status: SubmissionExtractionStatus): StatusDisplay {
  return EXTRACTION_STATUS[status];
}

export function extractionStatusLabel(status: SubmissionExtractionStatus): string {
  return EXTRACTION_STATUS[status].label;
}
