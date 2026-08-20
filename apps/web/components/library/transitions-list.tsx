"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowRightIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { DataList } from "@selecta/ui/components/data-list";
import { SearchField } from "@selecta/ui/components/search-field";
import { Select } from "@selecta/ui/components/select";
import { StatePanel } from "@selecta/ui/components/state-panel";

import {
  ClearFiltersButton,
  FilterField,
  FilteredListShell,
} from "@/components/common/filtered-list-shell";
import {
  LibraryTransitionColumnHeader,
  LibraryTransitionRow,
  TransitionReviewRow,
} from "@/components/library/transition-row";
import { useFilteredList } from "@/hooks/use-filtered-list";
import { DEFAULT_PAGE_SIZE } from "@/hooks/use-paginated-list";
import { artistLine } from "@/lib/format";
import { libraryAddHref } from "@/lib/library/add-routes";
import {
  transitionListQuery,
  type TransitionListFilters,
  type TransitionState,
} from "@/lib/library/list-params";
import { listProposals, type ApiProposal, type ApiProposalTrackSummary } from "@/lib/proposals/api";
import { listTransitions } from "@/lib/transitions/api";

const STATE_OPTIONS: Array<{ value: TransitionState; label: string }> = [
  { value: "all", label: "All transitions" },
  { value: "confirmed", label: "Confirmed" },
  { value: "needs_review", label: "Needs review" },
];

/**
 * The review queue has no server-side endpoint search, so the same two fields are
 * applied to it here — otherwise typing a title would silently skip the queue.
 */
function endpointMatches(track: ApiProposalTrackSummary | null, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (!track) return false;
  return (
    track.title.toLowerCase().includes(needle) ||
    artistLine(track.artists).toLowerCase().includes(needle)
  );
}

export function TransitionsList() {
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [state, setState] = useState<TransitionState>("all");
  const [pendingProposals, setPendingProposals] = useState<ApiProposal[]>([]);
  const filters = useMemo(() => ({ fromQuery, toQuery, state }), [fromQuery, toQuery, state]);
  const hasFilters = Boolean(fromQuery || toQuery || state !== "all");

  const fetchPage = useCallback(
    async (next: TransitionListFilters, page: { offset: number; limit: number }) => {
      const wantsReview = next.state !== "confirmed";
      const wantsCommitted = next.state !== "needs_review";

      if (page.offset > 0) {
        const response = await listTransitions(transitionListQuery(next, page));
        return { items: response.transitions, hasMore: response.hasMore };
      }

      try {
        const [transitionResponse, proposalResponse] = await Promise.all([
          wantsCommitted ? listTransitions(transitionListQuery(next, page)) : null,
          wantsReview ? listProposals({ status: "needs_review,failed", limit: page.limit }) : null,
        ]);
        setPendingProposals(proposalResponse?.proposals ?? []);
        return {
          items: transitionResponse?.transitions ?? [],
          hasMore: transitionResponse?.hasMore ?? false,
        };
      } catch (error) {
        setPendingProposals([]);
        throw error;
      }
    },
    [],
  );

  const list = useFilteredList({
    filters,
    fetchPage,
    resource: "transitions",
    pagination: true,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const showCommitted = state !== "needs_review";
  const reviewQueue = useMemo(
    () =>
      pendingProposals.filter(
        (proposal) =>
          endpointMatches(proposal.fromTrack, fromQuery) &&
          endpointMatches(proposal.toTrack, toQuery),
      ),
    [pendingProposals, fromQuery, toQuery],
  );

  function clearFilters() {
    setFromQuery("");
    setToQuery("");
    setState("all");
  }

  return (
    <FilteredListShell
      filtersAriaLabel="Transition filters"
      listAriaLabel="Transitions"
      filterGridClassName="md:grid-cols-[minmax(0,1fr)_1.875rem_minmax(0,1fr)_10.625rem]"
      filterControls={
        <>
          <FilterField htmlFor="transitions-from" label="From track">
            <SearchField
              id="transitions-from"
              placeholder="From track"
              value={fromQuery}
              onChange={(event) => setFromQuery(event.target.value)}
            />
          </FilterField>
          <span className="text-muted-foreground hidden justify-center opacity-60 md:flex">
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </span>
          <FilterField htmlFor="transitions-to" label="To track">
            <SearchField
              id="transitions-to"
              placeholder="To track"
              value={toQuery}
              onChange={(event) => setToQuery(event.target.value)}
            />
          </FilterField>
          <FilterField htmlFor="transitions-state" label="State">
            <Select
              id="transitions-state"
              value={state}
              onChange={(event) => setState(event.target.value as TransitionState)}
            >
              {STATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
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
      unavailableTitle="Transitions unavailable"
      loadingAriaLabel="Loading transitions"
      error={list.error}
      hasFetched={list.hasFetched}
      hasFilters={hasFilters}
      items={list.items}
      getItemKey={(transition) => transition.id}
      hasContent={list.items.length > 0 || reviewQueue.length > 0}
      hideMainList={!showCommitted}
      listHeading={<LibraryTransitionColumnHeader />}
      leading={
        reviewQueue.length > 0 ? (
          <>
            <div className="bg-surface-1 flex h-8 items-center gap-2 border-b px-3.5">
              <span className="text-eyebrow">Needs review</span>
              <span className="bg-warning-subtle text-warning text-numeric rounded-full px-1.5 text-xs font-medium">
                {reviewQueue.length}
              </span>
            </div>
            <DataList className="rounded-none border-0">
              {reviewQueue.map((proposal) => (
                <TransitionReviewRow key={proposal.id} proposal={proposal} />
              ))}
            </DataList>
          </>
        ) : state === "needs_review" ? (
          <StatePanel
            variant="empty"
            title="Nothing needs review"
            description="Every proposal has been committed or rejected."
          />
        ) : null
      }
      leadingBleed
      renderRow={(transition) => <LibraryTransitionRow transition={transition} />}
      empty={{
        noneTitle: "No transitions yet",
        noneDescription: "Add a transition to start capturing mix knowledge.",
        filteredTitle: "No matching transitions",
        action: (
          <Button asChild size="sm">
            <Link href={libraryAddHref("submissions", "transitions")}>Add a transition</Link>
          </Button>
        ),
      }}
      pagination={
        showCommitted
          ? {
              hasMore: list.hasMore,
              loadingMore: list.loadingMore,
              onLoadMore: () => void list.loadMore(),
            }
          : undefined
      }
    />
  );
}
