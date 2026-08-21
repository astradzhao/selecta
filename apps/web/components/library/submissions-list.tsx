"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@selecta/ui/components/button";
import { DataList } from "@selecta/ui/components/data-list";
import { SearchField } from "@selecta/ui/components/search-field";
import { Select } from "@selecta/ui/components/select";

import {
  ClearFiltersButton,
  FilterField,
  FilteredListShell,
} from "@/components/common/filtered-list-shell";
import { LibraryGroupHeader } from "@/components/library/library-group-header";
import {
  LibrarySubmissionColumnHeader,
  LibrarySubmissionRow,
} from "@/components/library/submission-row";
import { useFilteredList } from "@/hooks/use-filtered-list";
import { libraryAddHref, libraryViewHref } from "@/lib/library/add-routes";
import { submissionListQuery, type SubmissionListFilters } from "@/lib/library/list-params";
import { listSubmissions, type SubmissionExtractionStatus } from "@/lib/submissions/api";
import { SUBMISSION_STATUS_FILTER_OPTIONS } from "@/lib/submissions/extraction-status";
import { partitionSubmissions } from "@/lib/submissions/submission-row";

export function SubmissionsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | SubmissionExtractionStatus>("");
  const needsReviewOnly = searchParams.get("needsReview") === "1";
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

  const { review, recent } = useMemo(() => partitionSubmissions(list.items), [list.items]);

  function clearFilters() {
    setQuery("");
    setStatus("");
    if (needsReviewOnly) router.replace(libraryViewHref("submissions"));
  }

  return (
    <FilteredListShell
      filtersAriaLabel="Submission filters"
      listAriaLabel="Submissions"
      filterGridClassName="md:grid-cols-[minmax(0,1fr)_10.625rem]"
      filterControls={
        <>
          <FilterField htmlFor="submissions-q" label="Search submissions">
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
      filterBar={hasFilters ? <ClearFiltersButton onClick={clearFilters} /> : null}
      count={null}
      showCountRow={false}
      unavailableTitle="Submissions unavailable"
      loadingAriaLabel="Loading submissions"
      error={list.error}
      hasFetched={list.hasFetched}
      hasFilters={hasFilters}
      items={recent}
      getItemKey={(submission) => submission.id}
      hasContent={list.items.length > 0}
      columnHeader={<LibrarySubmissionColumnHeader />}
      leading={
        review.length > 0 ? (
          <>
            <LibraryGroupHeader label="Needs review" count={review.length} />
            <DataList className="rounded-none border-0">
              {review.map((submission) => (
                <LibrarySubmissionRow key={submission.id} submission={submission} />
              ))}
            </DataList>
          </>
        ) : null
      }
      leadingBleed
      listHeading={
        review.length > 0 && recent.length > 0 ? <LibraryGroupHeader label="Recent" /> : null
      }
      renderRow={(submission) => <LibrarySubmissionRow submission={submission} />}
      empty={{
        noneTitle: "No submissions yet",
        noneDescription: "Submit a transition to capture mix knowledge.",
        filteredTitle: "No matching submissions",
        action: (
          <Button asChild size="sm">
            <Link href={libraryAddHref("submissions")}>Write your first submission</Link>
          </Button>
        ),
      }}
      pagination={{
        hasMore: list.hasMore,
        loadingMore: list.loadingMore,
        onLoadMore: () => void list.loadMore(),
      }}
      errorBanner={false}
    />
  );
}
