"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { PageBreadcrumb, PageHeader } from "@selecta/ui/components/page-header";
import { StatePanel } from "@selecta/ui/components/state-panel";
import { Textarea } from "@selecta/ui/components/textarea";

import { FormField } from "@/components/common/form-field";
import { ExtractionStatusBadge } from "@/components/common/status-badge";
import { SubmissionProposals } from "@/components/library/submission-proposals";
import { SubmissionTrackLinks } from "@/components/library/submission-track-links";
import { describeApiError } from "@/lib/api/errors";
import { formatTimestamp } from "@/lib/format";
import { libraryViewHref } from "@/lib/library/add-routes";
import {
  extractSubmission,
  getSubmission,
  type ApiSubmission,
  type ApiSubmissionTrackLink,
  type SubmissionExtractionStatus,
} from "@/lib/submissions/api";

const LIST_HREF = libraryViewHref("submissions");

function canRetry(status: SubmissionExtractionStatus): boolean {
  return (
    status === "failed" ||
    status === "idle" ||
    status === "needs_review" ||
    status === "partially_committed" ||
    status === "commit_failed"
  );
}

function proposalCountsLine(submission: ApiSubmission): string | null {
  const counts = submission.proposalCounts;
  if (!counts) return null;
  return `${counts.committed} committed · ${counts.needsReview} need review · ${counts.failed} failed`;
}

export function SubmissionDetail({ submissionId }: { submissionId: string }) {
  const [submission, setSubmission] = useState<ApiSubmission | null>(null);
  const [trackLinks, setTrackLinks] = useState<ApiSubmissionTrackLink[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [retrying, startRetry] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getSubmission(submissionId);
        if (cancelled) return;
        setSubmission(response.submission);
        setTrackLinks(response.submission.trackLinks ?? []);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setSubmission(null);
        setLoadError(describeApiError(err, { fallback: "Failed to load submission." }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  useEffect(() => {
    if (submission?.extractionStatus !== "extracting") return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void getSubmission(submissionId)
        .then((response) => {
          if (cancelled) return;
          setSubmission(response.submission);
          setTrackLinks(response.submission.trackLinks ?? []);
        })
        .catch(() => {
          /* keep last known submission; next poll may succeed */
        });
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [submissionId, submission?.extractionStatus]);

  function onRetryExtraction() {
    if (!submission) return;
    startRetry(async () => {
      try {
        const response = await extractSubmission(submission.id);
        setSubmission(response.submission);
        setTrackLinks(response.submission.trackLinks ?? trackLinks);
        setRetryError(null);
      } catch (err) {
        setRetryError(
          describeApiError(err, { fallback: "Failed to retry extraction. Is the API running?" }),
        );
      }
    });
  }

  if (loading && !submission) {
    return <StatePanel variant="loading">Loading submission…</StatePanel>;
  }

  if (loadError || !submission) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">{loadError ?? "Submission not found."}</Alert>
        <Button asChild variant="outline">
          <Link href={LIST_HREF}>Back to submissions</Link>
        </Button>
      </div>
    );
  }

  const countsLine = proposalCountsLine(submission);

  return (
    <div className="space-y-10">
      <PageHeader
        lead={
          <PageBreadcrumb>
            <Link href={LIST_HREF} className="hover:text-foreground transition-colors">
              Submissions
            </Link>
            {" / "}
            Detail
          </PageBreadcrumb>
        }
        title="Submission"
        description={
          <span className="text-numeric">Created {formatTimestamp(submission.createdAt)}</span>
        }
      />

      <div className="space-y-4">
        <FormField
          id="submission-raw-text"
          label="Raw text"
          description="Submissions are immutable. Edit committed transitions or resolve review items instead."
        >
          <Textarea value={submission.rawText} readOnly className="bg-surface-1 min-h-56" />
        </FormField>
        <Button asChild type="button" variant="outline">
          <Link href={LIST_HREF}>Back to submissions</Link>
        </Button>
      </div>

      <div className="space-y-3">
        <section className="space-y-1" aria-live="polite">
          <p className="text-card-title flex flex-wrap items-center gap-2">
            Extraction
            <ExtractionStatusBadge status={submission.extractionStatus} />
          </p>
          {countsLine ? <p className="text-muted-foreground text-sm">{countsLine}</p> : null}
          {submission.extractionStatus === "failed" && submission.extractionError ? (
            <Alert variant="destructive">{submission.extractionError}</Alert>
          ) : null}
        </section>
        <SubmissionProposals submissionId={submission.id} rawText={submission.rawText} />
        {retryError ? <Alert variant="destructive">{retryError}</Alert> : null}
        {canRetry(submission.extractionStatus) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={retrying}
            onClick={onRetryExtraction}
          >
            {retrying ? "Retrying…" : "Retry processing"}
          </Button>
        ) : null}
      </div>

      <SubmissionTrackLinks
        submissionId={submission.id}
        initialLinks={trackLinks}
        onLinksChange={(next) => {
          setTrackLinks(next);
          setSubmission((current) => (current ? { ...current, trackLinks: next } : current));
        }}
      />
    </div>
  );
}
