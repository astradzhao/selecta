"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon, ListIcon, LoaderCircleIcon, XIcon } from "lucide-react";

import { DataListRow } from "@selecta/ui/components/data-list";
import { cn } from "@selecta/ui/lib/utils";

import { ExtractionStatusBadge } from "@/components/common/status-badge";
import { formatCompactAge, formatTimestamp, previewText } from "@/lib/format";
import { extractionStatus } from "@/lib/submissions/extraction-status";
import { CRATE_SUBMISSION_GRID, submissionSubtitle } from "@/lib/submissions/submission-row";
import type { ApiSubmission } from "@/lib/submissions/types";
import type { StatusTone } from "@/lib/status";

const TILE_TONE: Record<StatusTone, string> = {
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  info: "bg-info-subtle text-info",
  destructive: "bg-destructive-subtle text-destructive",
  neutral: "bg-surface-3 text-muted-foreground",
};

function StatusTile({ status }: { status: ApiSubmission["extractionStatus"] }) {
  const display = extractionStatus(status);
  const Icon =
    display.tone === "success"
      ? CheckIcon
      : display.tone === "warning"
        ? AlertTriangleIcon
        : display.tone === "info"
          ? LoaderCircleIcon
          : display.tone === "destructive"
            ? XIcon
            : ListIcon;

  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md",
        TILE_TONE[display.tone],
      )}
      aria-hidden
    >
      <Icon className={cn("size-4", display.inProgress && "motion-safe:animate-spin")} />
    </span>
  );
}

function CountCell({
  value,
  tone,
  icon,
}: {
  value: number;
  tone?: "success" | "warning";
  icon?: ReactNode;
}) {
  if (value <= 0) {
    return (
      <span className="text-crate-meta hidden text-center opacity-40 sm:block" aria-hidden>
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "text-crate-meta hidden justify-center font-medium sm:flex",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
      )}
    >
      <span className="inline-flex items-center gap-1">
        {icon}
        {value}
      </span>
    </span>
  );
}

export function LibrarySubmissionRow({ submission }: { submission: ApiSubmission }) {
  const preview = previewText(submission.rawText, {
    maxLength: 160,
    fallback: "Empty submission",
  });
  const empty = !submission.rawText.trim();
  const subtitle = submissionSubtitle(submission);
  const counts = submission.proposalCounts;

  return (
    <DataListRow interactive={false}>
      <Link
        href={`/library/submissions/${submission.id}`}
        aria-label={preview}
        className={cn(
          CRATE_SUBMISSION_GRID,
          "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-ring/50 min-h-14 transition-colors focus-visible:ring-3 focus-visible:outline-none",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <StatusTile status={submission.extractionStatus} />
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate",
                empty ? "text-muted-foreground italic" : "text-card-title",
              )}
            >
              {preview}
            </span>
            {subtitle.length > 0 ? (
              <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                {subtitle.map((part, index) => (
                  <span key={`${part.text}-${index}`} className="flex min-w-0 items-center gap-1.5">
                    {index > 0 ? (
                      <span aria-hidden className="opacity-40">
                        ·
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        part.tone === "destructive" && "text-destructive",
                      )}
                    >
                      {part.text}
                    </span>
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </span>
        <span className="min-w-0">
          <ExtractionStatusBadge status={submission.extractionStatus} />
        </span>
        <CountCell
          value={counts?.committed ?? 0}
          tone="success"
          icon={<CheckIcon className="size-3" aria-hidden />}
        />
        <CountCell value={counts?.needsReview ?? 0} tone="warning" />
        <span className="text-crate-meta text-center" title={formatTimestamp(submission.createdAt)}>
          {formatCompactAge(submission.createdAt)}
        </span>
      </Link>
    </DataListRow>
  );
}

export function LibrarySubmissionColumnHeader() {
  return (
    <div
      className={cn(CRATE_SUBMISSION_GRID, "text-eyebrow bg-surface-1 hidden h-8 border-b sm:grid")}
      aria-hidden
    >
      <span>Note</span>
      <span>Status</span>
      <span className="text-center">Committed</span>
      <span className="text-center">Review</span>
      <span className="text-center">Added</span>
    </div>
  );
}
