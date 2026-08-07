"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

import { ApiClientError } from "@/lib/api/client";
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

export function TransitionsList() {
  const [query, setQuery] = useState("");
  const [technique, setTechnique] = useState("");
  const [intent, setIntent] = useState("");
  const [source, setSource] = useState<"" | "manual" | "ai">("");
  const [transitions, setTransitions] = useState<ApiTransition[]>([]);
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
          const response = await listTransitions({
            query,
            technique,
            intent,
            source: source || undefined,
            limit: PAGE_SIZE,
            offset: 0,
          });
          if (cancelled) return;
          setTransitions(response.transitions);
          setHasMore(response.hasMore);
          setError(null);
          setHasFetched(true);
        } catch (err) {
          if (cancelled) return;
          setTransitions([]);
          setHasMore(false);
          setError(
            err instanceof ApiClientError
              ? err.code === "graph_not_configured"
                ? "The local graph database isn’t running. Start the full stack with `pnpm dev`."
                : err.message
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

  return (
    <div className="space-y-6">
      <section aria-label="Transition filters" className="space-y-3">
        <div className="grid items-end gap-4 md:grid-cols-[minmax(0,2fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="transitions-q">Search</Label>
            <div className="relative">
              <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="transitions-q"
                className="pl-10"
                placeholder="Track title or artist"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-technique">Technique</Label>
            <Input
              id="filter-technique"
              placeholder="e.g. cut"
              value={technique}
              onChange={(event) => setTechnique(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-intent">Intent</Label>
            <Input
              id="filter-intent"
              placeholder="e.g. energy up"
              value={intent}
              onChange={(event) => setIntent(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-source">Source</Label>
            <select
              id="filter-source"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={source}
              onChange={(event) => setSource(event.target.value as "" | "manual" | "ai")}
            >
              <option value="">Any</option>
              <option value="manual">Manual</option>
              <option value="ai">From submission</option>
            </select>
          </div>
        </div>

        {!error || hasFilters ? (
          <div className="flex min-h-7 items-center justify-between gap-4">
            <p className="text-muted-foreground text-xs" aria-live="polite">
              {isInitialLoading
                ? "Loading transitions…"
                : error
                  ? null
                  : `${transitions.length}${hasMore ? "+" : ""} ${
                      transitions.length === 1 ? "transition" : "transitions"
                    }`}
            </p>
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
                }}
              >
                <XIcon />
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-label="Transitions">
        {error && transitions.length === 0 ? (
          <div className="border-border bg-muted/30 rounded-xl border px-5 py-6">
            <h2 className="font-medium">Transitions unavailable</h2>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm">{error}</p>
          </div>
        ) : isInitialLoading ? (
          <div
            className="border-border text-muted-foreground rounded-xl border px-5 py-10 text-sm"
            aria-busy="true"
          >
            Loading transitions…
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
              {transitions.map((transition) => (
                <li key={transition.id}>
                  <Link
                    href={`/library/transitions/${transition.id}`}
                    className="hover:bg-muted/50 flex flex-col gap-2 px-4 py-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
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
                      <span className="text-muted-foreground text-xs">
                        {formatTimestamp(transition.createdAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
              {hasFetched && transitions.length === 0 ? (
                <li className="flex flex-col items-start gap-3 px-5 py-10">
                  <div>
                    <h2 className="font-medium">
                      {hasFilters ? "No matching transitions" : "No transitions yet"}
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {hasFilters
                        ? "Try clearing a filter or searching for something else."
                        : "Add a transition note to start capturing mix knowledge."}
                    </p>
                  </div>
                  {!hasFilters ? (
                    <Button asChild size="sm">
                      <Link href="/notes/new">Add a transition</Link>
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
            {error && transitions.length > 0 ? (
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
