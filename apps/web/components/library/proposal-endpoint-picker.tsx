"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
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

function mentionHeading(mention: ProposalMention): string {
  if (mention.mention?.trim()) return mention.mention.trim();
  const hints = [mention.titleHint, mention.artistHint].filter(Boolean).join(" — ");
  return hints || mention.mentionId || "Mention";
}

function mentionHints(mention: ProposalMention): string | null {
  const parts = [mention.titleHint, mention.artistHint].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(" · ");
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

function endpointSummary(endpoint: ReviewerEndpointBody | null): string | null {
  if (!endpoint) return null;
  if (endpoint.kind === "track") return `Library track · ${endpoint.trackId.slice(0, 8)}…`;
  return `${endpoint.title} · ${endpoint.artists.join(", ")}`;
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
  if (candidate.providerId) return "Would import";
  return null;
}

export function ProposalEndpointPicker({
  label,
  mention,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  mention: ProposalMention | null;
  value: ReviewerEndpointBody | null;
  onChange: (next: ReviewerEndpointBody | null) => void;
  disabled?: boolean;
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

  const defaultQuery = useMemo(() => {
    const parts = [mention?.mention, mention?.titleHint, mention?.artistHint]
      .filter((part): part is string => Boolean(part?.trim()))
      .map((part) => part.trim());
    return parts.join(" ");
  }, [mention]);

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

  return (
    <section className="border-border space-y-3 rounded-lg border px-3 py-3">
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className="font-medium">{mention ? mentionHeading(mention) : "Unknown mention"}</p>
        {mention && mentionHints(mention) ? (
          <p className="text-muted-foreground text-sm">{mentionHints(mention)}</p>
        ) : null}
        {value ? (
          <p className="text-muted-foreground text-sm">Selected: {endpointSummary(value)}</p>
        ) : (
          <p className="text-muted-foreground text-sm">No endpoint selected yet.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["suggested", "Suggested"],
            ["library", "My library"],
            ["catalog", "Catalog"],
          ] as const
        ).map(([id, tabLabel]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? "default" : "outline"}
            disabled={disabled}
            onClick={() => {
              setTab(id);
              if (id !== "suggested" && !query.trim()) {
                setQuery(defaultQuery);
              }
            }}
          >
            {tabLabel}
          </Button>
        ))}
      </div>

      {tab === "suggested" ? (
        candidates.length > 0 ? (
          <ul className="divide-border border-border divide-y overflow-hidden rounded-md border">
            {candidates.map((candidate) => {
              const endpoint = endpointFromCandidate(candidate);
              const selected = endpointsEqual(value, endpoint);
              const badge = candidateBadge(candidate);
              const parserSelected = selectedHandle === candidate.handle;
              return (
                <li key={candidate.handle}>
                  <button
                    type="button"
                    disabled={disabled || !endpoint}
                    onClick={() => endpoint && onChange(endpoint)}
                    className={cn(
                      "hover:bg-muted/50 flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors",
                      selected && "bg-muted/60",
                    )}
                  >
                    <span className="font-medium">{candidate.title}</span>
                    <span className="text-muted-foreground text-sm">
                      {artistLine(candidate.artists)}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {badge ? <Badge variant="secondary">{badge}</Badge> : null}
                      {parserSelected ? <Badge variant="outline">Selected by parser</Badge> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No suggested candidates for this mention.</p>
        )
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`${label}-search`}>Search</Label>
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
          {searchError ? <p className="text-sm">{searchError}</p> : null}
          {searching ? <p className="text-muted-foreground text-sm">Searching…</p> : null}
          <ul className="divide-border border-border divide-y overflow-hidden rounded-md border">
            {(tab === "library" ? libraryTracks : catalogTracks).map((track) => {
              const endpoint =
                tab === "library"
                  ? endpointFromTrack(track as ApiTrack)
                  : endpointFromCatalog(track as CatalogTrack);
              const selected = endpointsEqual(value, endpoint);
              const title = track.title;
              const artists =
                tab === "library"
                  ? artistLine((track as ApiTrack).artists)
                  : artistLine((track as CatalogTrack).artists);
              return (
                <li
                  key={
                    tab === "library" ? (track as ApiTrack).id : (track as CatalogTrack).providerId
                  }
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(endpoint)}
                    className={cn(
                      "hover:bg-muted/50 flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors",
                      selected && "bg-muted/60",
                    )}
                  >
                    <span className="font-medium">{title}</span>
                    <span className="text-muted-foreground text-sm">{artists}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Need a track that isn&apos;t listed?{" "}
        <Link href="/add" className="text-foreground underline-offset-4 hover:underline">
          Add manually
        </Link>
      </p>
    </section>
  );
}
