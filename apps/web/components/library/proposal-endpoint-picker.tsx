"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckIcon } from "lucide-react";

import { SegmentedTab, SegmentedTabs } from "@selecta/ui/components/segmented-tabs";
import { cn } from "@selecta/ui/lib/utils";

import { TrackPicker } from "@/components/tracks/track-picker";
import type { CatalogTrack } from "@/lib/catalog/types";
import { artistLine } from "@/lib/format";
import type { ApiProposalCandidate, ReviewerEndpointBody } from "@/lib/proposals/types";
import type { ApiTrack } from "@/lib/tracks/api";
import type { TrackRowItem } from "@/lib/tracks/track-row-item";

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
  const [pickedLibrary, setPickedLibrary] = useState<ApiTrack | null>(null);

  const candidates = useMemo(() => mention?.candidates ?? [], [mention?.candidates]);
  const selectedHandle = mention?.selectedCandidateId ?? null;

  const defaultQuery = useMemo(
    () => uniqueParts([mention?.mention, mention?.titleHint, mention?.artistHint]).join(" "),
    [mention],
  );

  const suggestedItems: TrackRowItem[] = candidates.map((candidate) => ({
    key: candidate.handle,
    title: candidate.title,
    artists: candidate.artists,
    artworkUrl: candidate.artworkUrl ?? candidate.track?.artworkUrl,
  }));

  const selectedSuggestedKey =
    candidates.find((candidate) => endpointsEqual(value, endpointFromCandidate(candidate)))
      ?.handle ?? null;

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    if (value.kind === "spotify") return trackLabel(value.title, value.artists);
    const candidate = candidates.find((item) => (item.trackId ?? item.track?.id) === value.trackId);
    if (candidate) return trackLabel(candidate.title, candidate.artists);
    if (pickedLibrary && pickedLibrary.id === value.trackId) {
      return trackLabel(pickedLibrary.title, pickedLibrary.artists);
    }
    return "Track already in your library";
  }, [value, candidates, pickedLibrary]);

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
          <SegmentedTabs variant="boxed" aria-label={`${label} source`}>
            {PICKER_TABS.map(([id, tabLabel]) => (
              <SegmentedTab
                key={id}
                type="button"
                disabled={disabled}
                active={tab === id}
                onClick={() => {
                  setTab(id);
                  if (id !== "suggested" && !query.trim()) {
                    setQuery(defaultQuery);
                  }
                }}
              >
                {tabLabel}
              </SegmentedTab>
            ))}
          </SegmentedTabs>

          {tab === "suggested" ? (
            <TrackPicker
              source="items"
              showSearch={false}
              items={suggestedItems}
              size="sm"
              selectedIndicator="check"
              selectedKey={selectedSuggestedKey}
              disabled={disabled}
              emptyNone="No suggestions for this mention. Search your library or the catalog instead."
              emptyFiltered="No suggestions for this mention. Search your library or the catalog instead."
              badges={(item) => {
                const candidate = candidates.find((entry) => entry.handle === item.key);
                if (!candidate) return [];
                return [
                  candidateBadge(candidate),
                  selectedHandle === candidate.handle ? "Parser pick" : null,
                ];
              }}
              onSelect={(item) => {
                const candidate = candidates.find((entry) => entry.handle === item.key);
                if (!candidate) return;
                const endpoint = endpointFromCandidate(candidate);
                if (endpoint) onChange(endpoint);
              }}
            />
          ) : tab === "library" ? (
            <TrackPicker
              id={`${label}-search`}
              source="library"
              query={query}
              onQueryChange={setQuery}
              limit={10}
              minQueryLength={1}
              size="sm"
              selectedIndicator="check"
              selectedKey={value?.kind === "track" ? value.trackId : null}
              disabled={disabled}
              placeholder="Search your library"
              emptyFiltered="No matches."
              emptyNone="Type to search."
              onSelect={(track) => {
                setPickedLibrary(track);
                onChange(endpointFromTrack(track));
              }}
            />
          ) : (
            <TrackPicker
              id={`${label}-search`}
              source="catalog"
              query={query}
              onQueryChange={setQuery}
              limit={10}
              minQueryLength={1}
              size="sm"
              selectedIndicator="check"
              selectedKey={value?.kind === "spotify" ? `spotify:${value.providerId}` : null}
              disabled={disabled}
              placeholder="Search catalog"
              emptyFiltered="No matches."
              emptyNone="Type to search."
              badges={() => ["Will import"]}
              onSelect={(track) => onChange(endpointFromCatalog(track))}
            />
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
