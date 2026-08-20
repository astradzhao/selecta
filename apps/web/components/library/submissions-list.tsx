"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlusIcon, XIcon } from "lucide-react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { Checkbox } from "@selecta/ui/components/checkbox";
import { EmptyState } from "@selecta/ui/components/empty-state";
import { Label } from "@selecta/ui/components/label";
import { ListSkeleton } from "@selecta/ui/components/list-skeleton";
import { SearchField } from "@selecta/ui/components/search-field";
import { Select } from "@selecta/ui/components/select";
import { StatePanel } from "@selecta/ui/components/state-panel";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { DEFAULT_PAGE_SIZE, usePaginatedList } from "@/hooks/use-paginated-list";
import { describeApiError } from "@/lib/api/errors";
import { formatTimestamp, previewText } from "@/lib/format";
import { listSubmissions, type NoteExtractionStatus } from "@/lib/notes/api";

const STATUS_OPTIONS: Array<{ value: "" | NoteExtractionStatus; label: string }> = [
  { value: "", label: "Any status" },
  { value: "needs_review", label: "Needs review" },
  { value: "partially_committed", label: "Partially committed" },
  { value: "committed", label: "Committed" },
  { value: "extracting", label: "Processing" },
  { value: "failed", label: "Failed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "commit_failed", label: "Commit failed" },
];

function statusLabel(status: NoteExtractionStatus): string {
  switch (status) {
    case "extracting":
      return "Processing";
    case "no_proposal":
      return "No proposal";
    case "resolving":
      return "Resolving";
    case "needs_review":
      return "Needs review";
    case "committed":
      return "Committed";
    case "partially_committed":
      return "Partial";
    case "commit_failed":
      return "Commit failed";
    case "failed":
      return "Failed";
    case "dismissed":
      return "Dismissed";
    case "idle":
    default:
      return "Idle";
  }
}

function statusVariant(
  status: NoteExtractionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "needs_review" || status === "failed" || status === "commit_failed") {
    return "destructive";
  }
  if (status === "committed") return "secondary";
  if (status === "partially_committed") return "outline";
  return "outline";
}

export function SubmissionsList() {
  const searchParams = useSearchParams();
  const initialNeedsReview = searchParams.get("needsReview") === "1";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | NoteExtractionStatus>("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(initialNeedsReview);
  const [hasFetched, setHasFetched] = useState(false);
  const filters = useMemo(
    () => ({ query, status, needsReviewOnly }),
    [query, status, needsReviewOnly],
  );
  const debouncedFilters = useDebouncedValue(filters);
  const fetchPage = useCallback(
    async ({ offset, limit }: { offset: number; limit: number }) => {
      const response = await listSubmissions({
        query: debouncedFilters.query,
        status: debouncedFilters.status || undefined,
        needsReview: debouncedFilters.needsReviewOnly ? true : undefined,
        limit,
        offset,
      });
      return { items: response.submissions ?? response.notes, hasMore: response.hasMore };
    },
    [debouncedFilters],
  );
  const {
    items: submissions,
    hasMore,
    loadMore,
    loadingMore,
    error,
    setError,
    replace,
  } = usePaginatedList({ fetchPage, resource: "submissions" });
  const hasFilters = Boolean(query || status || needsReviewOnly);
  const isInitialLoading = !hasFetched && !error;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const page = await fetchPage({ offset: 0, limit: DEFAULT_PAGE_SIZE });
        if (cancelled) return;
        replace(page);
      } catch (err) {
        if (cancelled) return;
        replace({ items: [], hasMore: false });
        setError(describeApiError(err, { resource: "submissions" }));
      } finally {
        if (!cancelled) setHasFetched(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage, replace, setError]);

  return (
    <div className="space-y-6">
      <section aria-label="Submission filters" className="space-y-3">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="submissions-q">Search</Label>
            <SearchField
              id="submissions-q"
              placeholder="Search submission text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-status">Status</Label>
            <Select
              id="filter-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "" | NoteExtractionStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "any"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-needs-review"
              checked={needsReviewOnly}
              onChange={(event) => setNeedsReviewOnly(event.target.checked)}
            />
            <Label htmlFor="filter-needs-review" className="font-normal">
              Needs review only
            </Label>
          </div>
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("");
                setNeedsReviewOnly(false);
              }}
            >
              <XIcon />
              Clear filters
            </Button>
          ) : null}
        </div>

        <div className="flex min-h-7 items-center justify-between gap-4">
          <p className="text-caption" aria-live="polite">
            {isInitialLoading
              ? "Loading submissions…"
              : error
                ? null
                : `${submissions.length}${hasMore ? "+" : ""} ${
                    submissions.length === 1 ? "submission" : "submissions"
                  }`}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/add?mode=transition">
              <PlusIcon />
              New submission
            </Link>
          </Button>
        </div>
      </section>

      <section aria-label="Submissions">
        {error && submissions.length === 0 ? (
          <StatePanel variant="error" title="Submissions unavailable" description={error} />
        ) : isInitialLoading ? (
          <ListSkeleton aria-label="Loading submissions" />
        ) : (
          <div className="space-y-3">
            <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
              {submissions.map((submission) => {
                const counts = submission.proposalCounts;
                return (
                  <li key={submission.id}>
                    <Link
                      href={`/library/submissions/${submission.id}`}
                      className="hover:bg-surface-2 flex flex-col gap-2 px-4 py-3 transition-colors"
                    >
                      <p className="text-card-title line-clamp-2 text-pretty">
                        {previewText(submission.rawText, {
                          maxLength: 120,
                          fallback: "Empty submission",
                        })}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(submission.extractionStatus)}>
                          {statusLabel(submission.extractionStatus)}
                        </Badge>
                        {counts && counts.total > 0 ? (
                          <span className="text-caption">
                            {counts.committed} committed
                            {counts.needsReview > 0 ? ` · ${counts.needsReview} need review` : null}
                            {counts.failed > 0 ? ` · ${counts.failed} failed` : null}
                          </span>
                        ) : null}
                        {(counts?.needsReview ?? 0) > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            Review {counts!.needsReview}
                          </Badge>
                        ) : null}
                        <span className="text-caption text-numeric">
                          {formatTimestamp(submission.createdAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
              {hasFetched && submissions.length === 0 ? (
                <li>
                  <EmptyState
                    title={hasFilters ? "No matching submissions" : "No submissions yet"}
                    description={
                      hasFilters
                        ? "Try clearing a filter or searching for something else."
                        : "Submit a transition note to capture mix knowledge."
                    }
                  >
                    {!hasFilters ? (
                      <Button asChild size="sm">
                        <Link href="/add?mode=transition">Write your first submission</Link>
                      </Button>
                    ) : null}
                  </EmptyState>
                </li>
              ) : null}
            </ul>
            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            ) : null}
            {error && submissions.length > 0 ? <Alert variant="destructive">{error}</Alert> : null}
          </div>
        )}
      </section>
    </div>
  );
}
