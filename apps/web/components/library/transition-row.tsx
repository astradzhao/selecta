"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { DataListRow } from "@selecta/ui/components/data-list";
import { cn } from "@selecta/ui/lib/utils";

import { ProposalStatusBadge } from "@/components/common/status-badge";
import { artistLine, formatCompactAge, formatTimestamp, previewText } from "@/lib/format";
import type { ApiProposal, ApiProposalTrackSummary } from "@/lib/proposals/api";
import { TRACK_ROW_ARTWORK_PX } from "@/lib/tracks/track-row-item";
import {
  CRATE_TRANSITION_GRID,
  EMPTY_SHIFT,
  formatBpmShift,
  formatKeyShift,
} from "@/lib/transitions/transition-row";
import type { ApiTransition, ApiTransitionEndpoint } from "@/lib/transitions/types";

const ARTWORK_PX = TRACK_ROW_ARTWORK_PX.sm;

/** Either side of the edge, or null when review has not matched a track yet. */
type EndpointView = {
  title: string;
  artistLabel: string;
  artworkUrl: string | null;
  bpm: number | null;
  musicalKey: string | null;
} | null;

function fromTransitionEndpoint(endpoint: ApiTransitionEndpoint): EndpointView {
  return {
    title: endpoint.title,
    artistLabel: artistLine(endpoint.artists),
    artworkUrl: endpoint.artworkUrl,
    bpm: endpoint.bpm,
    musicalKey: endpoint.musicalKey,
  };
}

function fromProposalEndpoint(track: ApiProposalTrackSummary | null): EndpointView {
  if (!track) return null;
  return {
    title: track.title,
    artistLabel: artistLine(track.artists),
    artworkUrl: track.artworkUrl,
    bpm: null,
    musicalKey: null,
  };
}

function EndpointCell({ endpoint }: { endpoint: EndpointView }) {
  if (!endpoint) {
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="border-border text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed text-sm">
          ?
        </span>
        <span className="min-w-0">
          <span className="text-muted-foreground block truncate text-sm italic">
            Unmatched track
          </span>
          <span className="text-muted-foreground block truncate text-xs">Pick one in review</span>
        </span>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="bg-muted ring-border relative size-10 shrink-0 overflow-hidden rounded-md ring-1 ring-inset">
        {endpoint.artworkUrl ? (
          <Image
            src={endpoint.artworkUrl}
            alt=""
            fill
            className="object-cover"
            sizes={`${ARTWORK_PX}px`}
          />
        ) : null}
      </span>
      <span className="min-w-0">
        <span className="text-card-title block truncate">{endpoint.title}</span>
        <span className="text-muted-foreground block truncate text-xs">{endpoint.artistLabel}</span>
      </span>
    </span>
  );
}

function TransitionArrow({ tone = "brand" }: { tone?: "brand" | "warning" }) {
  return (
    <span
      className={cn(
        "mx-auto flex size-6 items-center justify-center rounded-full",
        tone === "brand" ? "bg-brand-subtle text-brand" : "bg-warning-subtle text-warning",
      )}
    >
      <ArrowRightIcon className="size-3" aria-hidden />
    </span>
  );
}

/** BPM and key on both sides — the numbers a DJ checks before trusting the edge. */
function MatchCell({ from, to }: { from: EndpointView; to: EndpointView }) {
  const bpm = formatBpmShift(from?.bpm, to?.bpm);
  const key = formatKeyShift(from?.musicalKey, to?.musicalKey);

  if (bpm === EMPTY_SHIFT && key === EMPTY_SHIFT) {
    return <span className="text-crate-meta hidden text-center opacity-40 sm:block">{bpm}</span>;
  }

  return (
    <span className="text-crate-meta hidden text-center sm:block">
      <span className={cn("block", bpm === EMPTY_SHIFT ? "opacity-40" : "text-foreground")}>
        {bpm}
      </span>
      <span className={cn("block", key === EMPTY_SHIFT && "opacity-40")}>{key}</span>
    </span>
  );
}

function TransitionTime({ iso }: { iso: string }) {
  return (
    <span className="text-crate-meta hidden text-center sm:block" title={formatTimestamp(iso)}>
      {formatCompactAge(iso)}
    </span>
  );
}

export function LibraryTransitionRow({ transition }: { transition: ApiTransition }) {
  const from = fromTransitionEndpoint(transition.fromTrack);
  const to = fromTransitionEndpoint(transition.toTrack);

  return (
    <DataListRow interactive={false}>
      <Link
        href={`/library/transitions/${transition.id}`}
        aria-label={`${transition.fromTrack.title} into ${transition.toTrack.title}`}
        className={cn(
          CRATE_TRANSITION_GRID,
          "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-ring/50 min-h-14 transition-colors focus-visible:ring-3 focus-visible:outline-none",
        )}
      >
        <EndpointCell endpoint={from} />
        <TransitionArrow />
        <EndpointCell endpoint={to} />
        <span className="hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex">
          {transition.technique ? (
            <Badge variant="secondary" className="max-w-full truncate">
              {transition.technique}
            </Badge>
          ) : null}
          {transition.intent ? (
            <Badge variant="secondary" className="max-w-full truncate">
              {transition.intent}
            </Badge>
          ) : null}
          {transition.proposal?.status === "needs_review" ? (
            <ProposalStatusBadge status="needs_review" />
          ) : null}
        </span>
        <MatchCell from={from} to={to} />
        <TransitionTime iso={transition.createdAt} />
      </Link>
    </DataListRow>
  );
}

/**
 * A proposal waiting on review, drawn with the same pair geometry as a committed
 * edge so reviewing is a comparison rather than a context switch.
 */
export function TransitionReviewRow({ proposal }: { proposal: ApiProposal }) {
  const from = fromProposalEndpoint(proposal.fromTrack);
  const to = fromProposalEndpoint(proposal.toTrack);
  const source = previewText(proposal.sourceText, {
    maxLength: 140,
    fallback: "Pending proposal",
  });

  return (
    <DataListRow interactive={false}>
      <Link
        href={`/library/submissions/${proposal.submissionId}/proposals/${proposal.id}`}
        className={cn(
          CRATE_TRANSITION_GRID,
          "hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-ring/50 min-h-14 py-2.5 transition-colors focus-visible:ring-3 focus-visible:outline-none",
        )}
      >
        <EndpointCell endpoint={from} />
        <TransitionArrow tone="warning" />
        <EndpointCell endpoint={to} />
        <span className="hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex">
          <ProposalStatusBadge status={proposal.status} />
        </span>
        <MatchCell from={from} to={to} />
        <TransitionTime iso={proposal.updatedAt} />
        <span className="border-border text-muted-foreground col-span-full mt-1 truncate border-l-2 pl-2.5 text-xs">
          {source}
        </span>
      </Link>
    </DataListRow>
  );
}

export function LibraryTransitionColumnHeader() {
  return (
    <div
      className={cn(CRATE_TRANSITION_GRID, "text-eyebrow bg-surface-1 hidden h-8 border-b sm:grid")}
      aria-hidden
    >
      <span>From</span>
      <span />
      <span>To</span>
      <span>Mix</span>
      <span className="text-center">Match</span>
      <span className="text-center">Added</span>
    </div>
  );
}
