"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { Checkbox } from "@selecta/ui/components/checkbox";
import { DataListRow } from "@selecta/ui/components/data-list";
import { Label } from "@selecta/ui/components/label";
import { SearchField } from "@selecta/ui/components/search-field";
import { Select } from "@selecta/ui/components/select";

import { AddNewButton } from "@/components/common/add-new-button";
import {
  ClearFiltersButton,
  FilterField,
  FilteredListShell,
} from "@/components/common/filtered-list-shell";
import { ExtractionStatusBadge } from "@/components/common/status-badge";
import { useFilteredList } from "@/hooks/use-filtered-list";
import { formatTimestamp, previewText } from "@/lib/format";
import { libraryAddHref } from "@/lib/library/add-routes";
import { submissionListQuery, type SubmissionListFilters } from "@/lib/library/list-params";
import { formatListCount } from "@/lib/library/list-view-state";
import { listSubmissions, type SubmissionExtractionStatus } from "@/lib/submissions/api";
import { SUBMISSION_STATUS_FILTER_OPTIONS } from "@/lib/submissions/extraction-status";

export function SubmissionsList() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | SubmissionExtractionStatus>("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(searchParams.get("needsReview") === "1");
  const filters = useMemo(
    () => ({ query, status, needsReviewOnly }),
    [query, status, needsReviewOnly],
  );
  const hasFilters = Boolean(query || status || needsReviewOnly);

  const fetchPage = useCallback(
    async (next: SubmissionListFilters, page: { offset: number; limit: number }) => {
      const response = await listSubmissions(submissionListQuery(next, page));
      return { items: response.submissions, hasMore: response.hasMore };
    },
    [],
  );

  const list = useFilteredList({
    filters,
    fetchPage,
    resource: "submissions",
    pagination: true,
  });

  return (
    <FilteredListShell
      filtersAriaLabel="Submission filters"
      listAriaLabel="Submissions"
      filterGridClassName="md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)]"
      filterControls={
        <>
          <FilterField htmlFor="submissions-q" label="Search">
            <SearchField
              id="submissions-q"
              placeholder="Search submission text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </FilterField>
          <FilterField htmlFor="filter-status" label="Status">
            <Select
              id="filter-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "" | SubmissionExtractionStatus)}
            >
              {SUBMISSION_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "any"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FilterField>
        </>
      }
      filterBar={
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
            <ClearFiltersButton
              onClick={() => {
                setQuery("");
                setStatus("");
                setNeedsReviewOnly(false);
              }}
            />
          ) : null}
        </div>
      }
      count={
        list.isInitialLoading
          ? "Loading submissions…"
          : list.error
            ? null
            : formatListCount(list.items.length, {
                singular: "submission",
                plural: "submissions",
                hasMore: list.hasMore,
              })
      }
      toolbar={<AddNewButton href={libraryAddHref("submissions")} label="New submission" />}
      unavailableTitle="Submissions unavailable"
      loadingAriaLabel="Loading submissions"
      error={list.error}
      hasFetched={list.hasFetched}
      hasFilters={hasFilters}
      items={list.items}
      getItemKey={(submission) => submission.id}
      renderRow={(submission) => {
        const counts = submission.proposalCounts;
        return (
          <DataListRow className="flex-col gap-2">
            <Link href={`/library/submissions/${submission.id}`}>
              <p className="text-card-title line-clamp-2 text-pretty">
                {previewText(submission.rawText, {
                  maxLength: 120,
                  fallback: "Empty submission",
                })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <ExtractionStatusBadge status={submission.extractionStatus} />
                {counts && counts.total > 0 ? (
                  <span className="text-caption">
                    {counts.committed} committed
                    {counts.needsReview > 0 ? ` · ${counts.needsReview} need review` : null}
                    {counts.failed > 0 ? ` · ${counts.failed} failed` : null}
                  </span>
                ) : null}
                {(counts?.needsReview ?? 0) > 0 ? (
                  <Badge variant="warning" className="text-xs">
                    Review {counts?.needsReview}
                  </Badge>
                ) : null}
                <span className="text-caption text-numeric">
                  {formatTimestamp(submission.createdAt)}
                </span>
              </div>
            </Link>
          </DataListRow>
        );
      }}
      empty={{
        noneTitle: "No submissions yet",
        noneDescription: "Submit a transition to capture mix knowledge.",
        filteredTitle: "No matching submissions",
        action: (
          <Button asChild size="sm">
            <Link href="/add?mode=transition">Write your first submission</Link>
          </Button>
        ),
      }}
      pagination={{
        hasMore: list.hasMore,
        loadingMore: list.loadingMore,
        onLoadMore: () => void list.loadMore(),
      }}
    />
  );
}
