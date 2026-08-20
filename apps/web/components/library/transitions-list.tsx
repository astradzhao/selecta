"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { Checkbox } from "@selecta/ui/components/checkbox";
import { EmptyState } from "@selecta/ui/components/empty-state";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { ListSkeleton } from "@selecta/ui/components/list-skeleton";
import { SearchField } from "@selecta/ui/components/search-field";
import { SectionHeading } from "@selecta/ui/components/section-heading";
import { Select } from "@selecta/ui/components/select";
import { StatePanel } from "@selecta/ui/components/state-panel";
import { cn } from "@selecta/ui/lib/utils";

import { ProposalStatusBadge } from "@/components/library/proposal-status-badge";
import { ApiClientError } from "@/lib/api/client";
import { listProposals, type ApiProposal } from "@/lib/proposals/api";
import { listTransitions, type ApiTransition } from "@/lib/transitions/api";

const PAGE_SIZE = 50;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function artistLine(artists: Array<{ name: string }>): string {
  return artists.map((artist) => artist.name).join(", ") || "Unknown artist";
}

function proposalPreview(proposal: ApiProposal): string {
  const text = proposal.sourceText.trim();
  if (!text) return "Pending proposal";
  return text.length > 100 ? `${text.slice(0, 97)}…` : text;
}

export function TransitionsList() {
  const [query, setQuery] = useState("");
  const [technique, setTechnique] = useState("");
  const [intent, setIntent] = useState("");
  const [source, setSource] = useState<"" | "manual" | "ai">("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);
  const [transitions, setTransitions] = useState<ApiTransition[]>([]);
  const [pendingProposals, setPendingProposals] = useState<ApiProposal[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFirstFetch = useRef(true);
  const hasFilters = Boolean(query || technique || intent || source);
  const isInitialLoading = !hasFetched && !error;

  useEffect(() => {
    let cancelled = false;
    const delay = isFirstFetch.current ? 0 : 220;
    isFirstFetch.current = false;

    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const [transitionResponse, proposalResponse] = await Promise.all([
            listTransitions({
              query,
              technique,
              intent,
              source: source || undefined,
              limit: PAGE_SIZE,
              offset: 0,
            }),
            listProposals({ status: "needs_review,failed", limit: PAGE_SIZE }),
          ]);
          if (cancelled) return;
          setTransitions(transitionResponse.transitions);
          setPendingProposals(proposalResponse.proposals);
          setHasMore(transitionResponse.hasMore);
          setError(null);
          setHasFetched(true);
        } catch (err) {
          if (cancelled) return;
          setTransitions([]);
          setPendingProposals([]);
          setHasMore(false);
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load transitions. Is the API running?",
          );
          setHasFetched(true);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, technique, intent, source]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const response = await listTransitions({
        query,
        technique,
        intent,
        source: source || undefined,
        limit: PAGE_SIZE,
        offset: transitions.length,
      });
      setTransitions((current) => [...current, ...response.transitions]);
      setHasMore(response.hasMore);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to load more transitions. Is the API running?",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const showCommitted = !needsReviewOnly;
  const visiblePending = needsReviewOnly ? pendingProposals : pendingProposals;

  return (
    <div className="space-y-6">
      <section aria-label="Transition filters" className="space-y-3">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="transitions-q">Search</Label>
            <SearchField
              id="transitions-q"
              placeholder="Track title or artist"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={needsReviewOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-technique">Technique</Label>
            <Input
              id="filter-technique"
              placeholder="e.g. cut"
              value={technique}
              onChange={(event) => setTechnique(event.target.value)}
              disabled={needsReviewOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-intent">Intent</Label>
            <Input
              id="filter-intent"
              placeholder="e.g. energy up"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
              disabled={needsReviewOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-source">Source</Label>
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
          </div>
        </div>

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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setTechnique("");
                setIntent("");
                setSource("");
                setNeedsReviewOnly(false);
              }}
            >
              <XIcon />
              Clear filters
            </Button>
          ) : null}
        </div>

        {!error || hasFilters ? (
          <div className="flex min-h-7 items-center justify-between gap-4">
            <p className="text-caption" aria-live="polite">
              {isInitialLoading
                ? "Loading transitions…"
                : error
                  ? null
                  : needsReviewOnly
                    ? `${visiblePending.length} need review`
                    : `${visiblePending.length} need review · ${transitions.length}${hasMore ? "+" : ""} committed`}
            </p>
          </div>
        ) : null}
      </section>

      <section aria-label="Transitions">
        {error && transitions.length === 0 && pendingProposals.length === 0 ? (
          <StatePanel variant="error" title="Transitions unavailable" description={error} />
        ) : isInitialLoading ? (
          <ListSkeleton aria-label="Loading transitions" />
        ) : (
          <div className="space-y-6">
            {visiblePending.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-eyebrow">Needs review</h2>
                <ul className="space-y-2">
                  {visiblePending.map((proposal) => (
                    <li key={proposal.id}>
                      <Link
                        href={`/library/submissions/${proposal.noteId}/proposals/${proposal.id}`}
                        className={cn(
                          "hover:bg-surface-2 flex flex-col gap-2 rounded-xl border border-dashed px-4 py-3 transition-colors",
                        )}
                      >
                        <p className="line-clamp-2 text-sm text-pretty">
                          {proposalPreview(proposal)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <ProposalStatusBadge status={proposal.status} />
                          <span className="text-caption text-numeric">
                            {formatTimestamp(proposal.updatedAt)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : needsReviewOnly ? (
              <StatePanel
                variant="empty"
                title="No proposals need review"
                description="Committed transitions are hidden while this filter is on."
              />
            ) : null}

            {showCommitted ? (
              <div className="space-y-3">
                {visiblePending.length > 0 ? (
                  <SectionHeading title="Committed transitions" />
                ) : null}
                <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
                  {transitions.map((transition) => (
                    <li key={transition.id}>
                      <Link
                        href={`/library/transitions/${transition.id}`}
                        className="hover:bg-surface-2 flex flex-col gap-2 px-4 py-3 transition-colors"
                      >
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
                          {transition.intent ? (
                            <Badge variant="outline">{transition.intent}</Badge>
                          ) : null}
                          {transition.proposal?.status === "needs_review" ? (
                            <Badge variant="destructive">Needs review</Badge>
                          ) : null}
                          <span className="text-caption text-numeric">
                            {formatTimestamp(transition.createdAt)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                  {hasFetched && transitions.length === 0 && !needsReviewOnly ? (
                    <li>
                      <EmptyState
                        title={hasFilters ? "No matching transitions" : "No transitions yet"}
                        description={
                          hasFilters
                            ? "Try clearing a filter or searching for something else."
                            : "Add a transition note to start capturing mix knowledge."
                        }
                      >
                        {!hasFilters ? (
                          <Button asChild size="sm">
                            <Link href="/add?mode=transition">Add a transition</Link>
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
              </div>
            ) : null}

            {error ? <Alert variant="destructive">{error}</Alert> : null}
          </div>
        )}
      </section>
    </div>
  );
}
