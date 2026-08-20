"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, SearchIcon } from "lucide-react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { cn } from "@selecta/ui/lib/utils";

import { searchCatalog } from "@/lib/catalog/api";
import type { CatalogTrack } from "@/lib/catalog/types";
import type { ApiProposalCandidate, ReviewerEndpointBody } from "@/lib/proposals/types";
import { listTracks, type ApiTrack } from "@/lib/tracks/api";

type ProposalMention = {
  mentionId?: string;
  mention?: string;
  titleHint?: string;
  artistHint?: string;
  selectedCandidateId?: string;
  candidates?: ApiProposalCandidate[];
};

type PickerTab = "suggested" | "library" | "catalog";

/** Dedupe case-insensitively; the parser often repeats the mention as the title hint. */
function uniqueParts(parts: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function mentionHeading(mention: ProposalMention): string {
  const parts = uniqueParts([mention.mention, mention.titleHint, mention.artistHint]);
  return parts[0] ?? mention.mentionId ?? "Mention";
}

function mentionHints(mention: ProposalMention): string | null {
  const heading = mentionHeading(mention).toLowerCase();
  const parts = uniqueParts([mention.titleHint, mention.artistHint]).filter(
    (part) => part.toLowerCase() !== heading,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

function artistLine(names: string[] | Array<{ name: string }>): string {
  if (names.length === 0) return "Unknown artist";
  if (typeof names[0] === "string") return (names as string[]).join(", ");
  return (names as Array<{ name: string }>).map((artist) => artist.name).join(", ");
}

function endpointFromCandidate(candidate: ApiProposalCandidate): ReviewerEndpointBody | null {
  if (candidate.trackId || candidate.track?.id) {
    return { kind: "track", trackId: candidate.trackId ?? candidate.track!.id };
  }
  if (candidate.providerId) {
    return {
      kind: "spotify",
      providerId: candidate.providerId,
      title: candidate.title,
      artists: candidate.artists,
      artworkUrl: candidate.artworkUrl ?? null,
      durationMs: candidate.durationMs ?? null,
    };
  }
  return null;
}

function endpointFromTrack(track: ApiTrack): ReviewerEndpointBody {
  return { kind: "track", trackId: track.id };
}

function endpointFromCatalog(track: CatalogTrack): ReviewerEndpointBody {
  return {
    kind: "spotify",
    providerId: track.providerId,
    title: track.title,
    artists: track.artists,
    artworkUrl: track.artworkUrl,
    durationMs: track.durationMs,
  };
}

function trackLabel(title: string, artists: string[] | Array<{ name: string }>): string {
  return `${title} — ${artistLine(artists)}`;
}

function endpointsEqual(a: ReviewerEndpointBody | null, b: ReviewerEndpointBody | null): boolean {
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === "track" && b.kind === "track") return a.trackId === b.trackId;
  if (a.kind === "spotify" && b.kind === "spotify") return a.providerId === b.providerId;
  return false;
}

function candidateBadge(candidate: ApiProposalCandidate): string | null {
  if (candidate.trackId || candidate.track) return "In library";
  if (candidate.providerId) return "Will import";
  return null;
}

const PICKER_TABS: ReadonlyArray<readonly [PickerTab, string]> = [
  ["suggested", "Suggested"],
  ["library", "My library"],
  ["catalog", "Catalog"],
];

export function ProposalEndpointPicker({
  label,
  mention,
  value,
  onChange,
  disabled = false,
  readOnly = false,
}: {
  label: string;
  mention: ProposalMention | null;
  value: ReviewerEndpointBody | null;
  onChange: (next: ReviewerEndpointBody | null) => void;
  disabled?: boolean;
  /** Decided proposals show only the chosen track, not the whole picker. */
  readOnly?: boolean;
}) {
  const [tab, setTab] = useState<PickerTab>("suggested");
  const [query, setQuery] = useState("");
  const [libraryTracks, setLibraryTracks] = useState<ApiTrack[]>([]);
  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const isFirstSearch = useRef(true);

  const candidates = mention?.candidates ?? [];
  const selectedHandle = mention?.selectedCandidateId ?? null;

  const defaultQuery = useMemo(
    () => uniqueParts([mention?.mention, mention?.titleHint, mention?.artistHint]).join(" "),
    [mention],
  );

  useEffect(() => {
    if (tab === "suggested") return;
    let cancelled = false;
    const delay = isFirstSearch.current ? 0 : 220;
    isFirstSearch.current = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        const q = query.trim() || defaultQuery;
        if (!q) {
          setLibraryTracks([]);
          setCatalogTracks([]);
          setSearchError(null);
          return;
        }
        setSearching(true);
        try {
          if (tab === "library") {
            const response = await listTracks({ query: q, limit: 10 });
            if (cancelled) return;
            setLibraryTracks(response.tracks);
            setSearchError(null);
          } else {
            const response = await searchCatalog(q, 10);
            if (cancelled) return;
            setCatalogTracks(response.results);
            setSearchError(null);
          }
        } catch (err) {
          if (cancelled) return;
          setLibraryTracks([]);
          setCatalogTracks([]);
          setSearchError(err instanceof Error ? err.message : "Search failed.");
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [tab, query, defaultQuery]);

  const searchResults = tab === "library" ? libraryTracks : catalogTracks;

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    if (value.kind === "spotify") return trackLabel(value.title, value.artists);
    const candidate = candidates.find((item) => (item.trackId ?? item.track?.id) === value.trackId);
    if (candidate) return trackLabel(candidate.title, candidate.artists);
    const libraryTrack = libraryTracks.find((track) => track.id === value.trackId);
    if (libraryTrack) return trackLabel(libraryTrack.title, libraryTrack.artists);
    return "Track already in your library";
  }, [value, candidates, libraryTracks]);

  return (
    <section className="border-border space-y-4 rounded-xl border p-4">
      <div className="space-y-1">
        <p className="text-eyebrow">{label}</p>
        <p className="font-medium break-words">
          {mention ? mentionHeading(mention) : "Unknown mention"}
        </p>
        {mention && mentionHints(mention) ? (
          <p className="text-muted-foreground text-sm">{mentionHints(mention)}</p>
        ) : null}
      </div>

      <div
        className={cn(
          "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
          value ? "border-border bg-surface-2" : "border-dashed text-muted-foreground",
        )}
      >
        {value ? (
          <>
            <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 break-words">{selectedLabel}</span>
            {!disabled && !readOnly ? (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-muted-foreground hover:text-foreground shrink-0 text-xs transition-colors"
              >
                Clear
              </button>
            ) : null}
          </>
        ) : (
          <span>{readOnly ? "No track recorded" : "Nothing selected yet"}</span>
        )}
      </div>

      {readOnly ? null : (
        <>
          <div className="bg-muted inline-flex rounded-lg p-0.5">
            {PICKER_TABS.map(([id, tabLabel]) => (
              <button
                key={id}
                type="button"
                disabled={disabled}
                aria-pressed={tab === id}
                onClick={() => {
                  setTab(id);
                  if (id !== "suggested" && !query.trim()) {
                    setQuery(defaultQuery);
                  }
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                  tab === id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          {tab === "suggested" ? (
            candidates.length > 0 ? (
              <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
                {candidates.map((candidate) => {
                  const endpoint = endpointFromCandidate(candidate);
                  const badge = candidateBadge(candidate);
                  return (
                    <li key={candidate.handle}>
                      <ResultRow
                        title={candidate.title}
                        artists={artistLine(candidate.artists)}
                        badges={[badge, selectedHandle === candidate.handle ? "Parser pick" : null]}
                        selected={endpointsEqual(value, endpoint)}
                        disabled={disabled || !endpoint}
                        onSelect={() => endpoint && onChange(endpoint)}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState>
                No suggestions for this mention. Search your library or the catalog instead.
              </EmptyState>
            )
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`${label}-search`} className="sr-only">
                  Search {tab === "library" ? "your library" : "the catalog"}
                </Label>
                <div className="relative">
                  <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id={`${label}-search`}
                    className="pl-10"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={tab === "library" ? "Search your library" : "Search catalog"}
                    disabled={disabled}
                  />
                </div>
              </div>
              {searchError ? <Alert variant="destructive">{searchError}</Alert> : null}
              {searching ? (
                <EmptyState>Searching…</EmptyState>
              ) : searchResults.length > 0 ? (
                <ul className="divide-border border-border divide-y overflow-hidden rounded-lg border">
                  {searchResults.map((track) => {
                    const endpoint =
                      tab === "library"
                        ? endpointFromTrack(track as ApiTrack)
                        : endpointFromCatalog(track as CatalogTrack);
                    const artists =
                      tab === "library"
                        ? artistLine((track as ApiTrack).artists)
                        : artistLine((track as CatalogTrack).artists);
                    return (
                      <li
                        key={
                          tab === "library"
                            ? (track as ApiTrack).id
                            : (track as CatalogTrack).providerId
                        }
                      >
                        <ResultRow
                          title={track.title}
                          artists={artists}
                          badges={[tab === "catalog" ? "Will import" : null]}
                          selected={endpointsEqual(value, endpoint)}
                          disabled={disabled}
                          onSelect={() => onChange(endpoint)}
                        />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState>
                  {query.trim() || defaultQuery ? "No matches." : "Type to search."}
                </EmptyState>
              )}
            </div>
          )}

          <p className="text-caption">
            Can&apos;t find it?{" "}
            <Link href="/add" className="text-foreground underline-offset-4 hover:underline">
              Add the track manually
            </Link>
          </p>
        </>
      )}
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-border text-muted-foreground rounded-lg border border-dashed px-3 py-4 text-sm">
      {children}
    </p>
  );
}

function ResultRow({
  title,
  artists,
  badges,
  selected,
  disabled,
  onSelect,
}: {
  title: string;
  artists: string;
  badges: Array<string | null>;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const visibleBadges = badges.filter((badge): badge is string => Boolean(badge));
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "hover:bg-surface-2 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50",
        selected && "bg-surface-3",
      )}
    >
      <span className="min-w-0 flex-1 space-y-1">
        <span className="text-card-title block truncate">{title}</span>
        <span className="text-muted-foreground block truncate text-sm">{artists}</span>
        {visibleBadges.length > 0 ? (
          <span className="flex flex-wrap gap-1.5 pt-0.5">
            {visibleBadges.map((badge) => (
              <Badge key={badge} variant="secondary" className="font-normal">
                {badge}
              </Badge>
            ))}
          </span>
        ) : null}
      </span>
      {selected ? <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
    </button>
  );
}
