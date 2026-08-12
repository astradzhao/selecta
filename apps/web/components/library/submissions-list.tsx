"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

import { ApiClientError } from "@/lib/api/client";
import { listSubmissions, type ApiNote, type NoteExtractionStatus } from "@/lib/notes/api";

const PAGE_SIZE = 50;

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

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function submissionPreview(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return "Empty submission";
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? trimmed;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}

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
  const [submissions, setSubmissions] = useState<ApiNote[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFirstFetch = useRef(true);
  const hasFilters = Boolean(query || status || needsReviewOnly);
  const isInitialLoading = !hasFetched && !error;

  useEffect(() => {
    let cancelled = false;
    const delay = isFirstFetch.current ? 0 : 220;
    isFirstFetch.current = false;

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await listSubmissions({
            query,
            status: status || undefined,
            needsReview: needsReviewOnly ? true : undefined,
            limit: PAGE_SIZE,
            offset: 0,
          });
          if (cancelled) return;
          setSubmissions(response.submissions ?? response.notes);
          setHasMore(response.hasMore);
          setError(null);
          setHasFetched(true);
        } catch (err) {
          if (cancelled) return;
          setSubmissions([]);
          setHasMore(false);
          setError(
            err instanceof ApiClientError
              ? err.code === "db_not_configured"
                ? "The local submissions database isn’t running. Start the full stack with `pnpm dev`."
                : err.message
              : "Failed to load submissions. Is the API running?",
          );
          setHasFetched(true);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, status, needsReviewOnly]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const response = await listSubmissions({
        query,
        status: status || undefined,
        needsReview: needsReviewOnly ? true : undefined,
        limit: PAGE_SIZE,
        offset: submissions.length,
      });
      const next = response.submissions ?? response.notes;
      setSubmissions((current) => [...current, ...next]);
      setHasMore(response.hasMore);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load more submissions. Is the API running?",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-label="Submission filters" className="space-y-3">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="submissions-q">Search</Label>
            <div className="relative">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="submissions-q"
                className="pl-10"
                placeholder="Search submission text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-status">Status</Label>
            <select
              id="filter-status"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as "" | NoteExtractionStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "any"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              id="filter-needs-review"
              type="checkbox"
              className="size-4 rounded border"
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
          <p className="text-muted-foreground text-xs" aria-live="polite">
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
          <div className="border-border bg-muted/30 rounded-xl border px-5 py-6">
            <h2 className="font-medium">Submissions unavailable</h2>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm">{error}</p>
          </div>
        ) : isInitialLoading ? (
          <div
            className="border-border text-muted-foreground rounded-xl border px-5 py-10 text-sm"
            aria-busy="true"
          >
            Loading submissions…
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
              {submissions.map((submission) => {
                const counts = submission.proposalCounts;
                return (
                  <li key={submission.id}>
                    <Link
                      href={`/library/submissions/${submission.id}`}
                      className="hover:bg-muted/50 flex flex-col gap-2 px-4 py-3 transition-colors"
                    >
                      <p className="line-clamp-2 font-medium text-pretty">
                        {submissionPreview(submission.rawText)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusVariant(submission.extractionStatus)}>
                          {statusLabel(submission.extractionStatus)}
                        </Badge>
                        {counts && counts.total > 0 ? (
                          <span className="text-muted-foreground text-xs">
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
                        <span className="text-muted-foreground text-xs">
                          {formatTimestamp(submission.createdAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
              {hasFetched && submissions.length === 0 ? (
                <li className="flex flex-col items-start gap-3 px-5 py-10">
                  <div>
                    <h2 className="font-medium">
                      {hasFilters ? "No matching submissions" : "No submissions yet"}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {hasFilters
                        ? "Try clearing a filter or searching for something else."
                        : "Submit a transition note to capture mix knowledge."}
                    </p>
                  </div>
                  {!hasFilters ? (
                    <Button asChild size="sm">
                      <Link href="/add?mode=transition">Write your first submission</Link>
                    </Button>
                  ) : null}
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
            {error && submissions.length > 0 ? (
              <p className="text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
