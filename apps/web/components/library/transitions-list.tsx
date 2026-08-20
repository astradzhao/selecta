"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { Checkbox } from "@selecta/ui/components/checkbox";
import { DataList, DataListRow, DataListSection } from "@selecta/ui/components/data-list";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { SearchField } from "@selecta/ui/components/search-field";
import { SectionHeading } from "@selecta/ui/components/section-heading";
import { Select } from "@selecta/ui/components/select";
import { StatePanel } from "@selecta/ui/components/state-panel";

import {
  ClearFiltersButton,
  FilterField,
  FilteredListShell,
} from "@/components/common/filtered-list-shell";
import { AddNewButton } from "@/components/common/add-new-button";
import { ProposalStatusBadge } from "@/components/common/status-badge";
import { useFilteredList } from "@/hooks/use-filtered-list";
import { DEFAULT_PAGE_SIZE } from "@/hooks/use-paginated-list";
import { artistLine, formatTimestamp, previewText } from "@/lib/format";
import { libraryAddHref } from "@/lib/library/add-routes";
import { transitionListQuery, type TransitionListFilters } from "@/lib/library/list-params";
import { listProposals, type ApiProposal } from "@/lib/proposals/api";
import { proposalStatusLabel } from "@/lib/proposals/proposal-status";
import { listTransitions } from "@/lib/transitions/api";

export function TransitionsList() {
  const [query, setQuery] = useState("");
  const [technique, setTechnique] = useState("");
  const [intent, setIntent] = useState("");
  const [source, setSource] = useState<"" | "manual" | "ai">("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [pendingProposals, setPendingProposals] = useState<ApiProposal[]>([]);
  const filters = useMemo(
    () => ({ query, technique, intent, source }),
    [query, technique, intent, source],
  );
  const hasFilters = Boolean(query || technique || intent || source);

  const fetchPage = useCallback(
    async (next: TransitionListFilters, page: { offset: number; limit: number }) => {
      if (page.offset === 0) {
        try {
          const [transitionResponse, proposalResponse] = await Promise.all([
            listTransitions(transitionListQuery(next, page)),
            listProposals({ status: "needs_review,failed", limit: page.limit }),
          ]);
          setPendingProposals(proposalResponse.proposals);
          return { items: transitionResponse.transitions, hasMore: transitionResponse.hasMore };
        } catch (error) {
          setPendingProposals([]);
          throw error;
        }
      }
      const response = await listTransitions(transitionListQuery(next, page));
      return { items: response.transitions, hasMore: response.hasMore };
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

  const showCommitted = !needsReviewOnly;

  return (
    <FilteredListShell
      filtersAriaLabel="Transition filters"
      listAriaLabel="Transitions"
      filterGridClassName="md:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)]"
      filterControls={
        <>
          <FilterField htmlFor="transitions-q" label="Search">
            <SearchField
              id="transitions-q"
              placeholder="Track title or artist"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={needsReviewOnly}
            />
          </FilterField>
          <FilterField htmlFor="filter-technique" label="Technique">
            <Input
              id="filter-technique"
              placeholder="e.g. cut"
              value={technique}
              onChange={(event) => setTechnique(event.target.value)}
              disabled={needsReviewOnly}
            />
          </FilterField>
          <FilterField htmlFor="filter-intent" label="Intent">
            <Input
              id="filter-intent"
              placeholder="e.g. energy up"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              disabled={needsReviewOnly}
            />
          </FilterField>
          <FilterField htmlFor="filter-source" label="Source">
            <Select
              id="filter-source"
              value={source}
              onChange={(event) => setSource(event.target.value as "" | "manual" | "ai")}
              disabled={needsReviewOnly}
            >
              <option value="">Any</option>
              <option value="manual">Manual</option>
              <option value="ai">From submission</option>
            </Select>
          </FilterField>
        </>
      }
      filterBar={
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="filter-needs-review-only"
              checked={needsReviewOnly}
              onChange={(event) => setNeedsReviewOnly(event.target.checked)}
            />
            <Label htmlFor="filter-needs-review-only" className="font-normal">
              Needs review only
            </Label>
          </div>
          {hasFilters ? (
            <ClearFiltersButton
              onClick={() => {
                setQuery("");
                setTechnique("");
                setIntent("");
                setSource("");
                setNeedsReviewOnly(false);
              }}
            />
          ) : null}
        </div>
      }
      count={
        list.isInitialLoading
          ? "Loading transitions…"
          : list.error
            ? null
            : needsReviewOnly
              ? `${pendingProposals.length} need review`
              : `${pendingProposals.length} need review · ${list.items.length}${list.hasMore ? "+" : ""} committed`
      }
      toolbar={
        <AddNewButton href={libraryAddHref("submissions", "transitions")} label="Add transition" />
      }
      unavailableTitle="Transitions unavailable"
      loadingAriaLabel="Loading transitions"
      error={list.error}
      hasFetched={list.hasFetched}
      hasFilters={hasFilters}
      items={list.items}
      getItemKey={(transition) => transition.id}
      hasContent={list.items.length > 0 || pendingProposals.length > 0}
      hideMainList={!showCommitted}
      listHeading={
        pendingProposals.length > 0 && showCommitted ? (
          <SectionHeading title="Committed transitions" />
        ) : null
      }
      leading={
        pendingProposals.length > 0 ? (
          <DataListSection
            title={<h2 className="text-eyebrow">{proposalStatusLabel("needs_review")}</h2>}
          >
            <DataList variant="plain">
              {pendingProposals.map((proposal) => (
                <DataListRow key={proposal.id} variant="dashed" className="flex-col gap-2">
                  <Link
                    href={`/library/submissions/${proposal.submissionId}/proposals/${proposal.id}`}
                  >
                    <p className="line-clamp-2 text-sm text-pretty">
                      {previewText(proposal.sourceText, {
                        maxLength: 100,
                        fallback: "Pending proposal",
                      })}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <ProposalStatusBadge status={proposal.status} />
                      <span className="text-caption text-numeric">
                        {formatTimestamp(proposal.updatedAt)}
                      </span>
                    </div>
                  </Link>
                </DataListRow>
              ))}
            </DataList>
          </DataListSection>
        ) : needsReviewOnly ? (
          <StatePanel
            variant="empty"
            title="No proposals need review"
            description="Committed transitions are hidden while this filter is on."
          />
        ) : null
      }
      renderRow={(transition) => (
        <DataListRow className="flex-col gap-2">
          <Link href={`/library/transitions/${transition.id}`}>
            <div className="min-w-0">
              <p className="text-card-title truncate">
                {transition.fromTrack.title}
                <span className="text-muted-foreground font-normal"> → </span>
                {transition.toTrack.title}
              </p>
              <p className="text-muted-foreground truncate text-sm">
                {artistLine(transition.fromTrack.artists)}
                <span className="text-muted-foreground/70"> → </span>
                {artistLine(transition.toTrack.artists)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {transition.technique ? (
                <Badge variant="secondary">{transition.technique}</Badge>
              ) : null}
              {transition.intent ? <Badge variant="outline">{transition.intent}</Badge> : null}
              {transition.proposal?.status === "needs_review" ? (
                <ProposalStatusBadge status="needs_review" />
              ) : null}
              <span className="text-caption text-numeric">
                {formatTimestamp(transition.createdAt)}
              </span>
            </div>
          </Link>
        </DataListRow>
      )}
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
