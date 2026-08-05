"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@selecta/ui/components/button";
import { Separator } from "@selecta/ui/components/separator";

import { ApiClientError, getTrack, type ApiTrack } from "@/lib/api";
import { TrackChips } from "@/components/tracks/track-chips";

function formatDuration(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  const total = Math.round(sec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function TrackDetail({ trackId }: { trackId: string }) {
  const [track, setTrack] = useState<ApiTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startLoad] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getTrack(trackId);
        if (cancelled) return;
        setTrack(response.track);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setTrack(null);
        setError(err instanceof ApiClientError ? err.message : "Failed to load track.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  if (pending && !track) {
    return <p className="text-muted-foreground text-sm">Loading track…</p>;
  }

  if (error || !track) {
    return (
      <div className="space-y-4">
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {error ?? "Track not found."}
        </p>
        <Button asChild variant="outline">
          <Link href="/library">Back to library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="bg-muted relative h-48 w-48 shrink-0 overflow-hidden rounded-2xl">
          {track.artworkUrl ? (
            <Image src={track.artworkUrl} alt="" fill className="object-cover" sizes="192px" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Track</p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">{track.title}</h1>
            <p className="text-muted-foreground text-base">
              {track.artists.map((artist) => artist.name).join(", ") || "Unknown artist"}
            </p>
          </div>
          <TrackChips subgenres={track.subgenres} folders={track.folders} />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/library">Back to library</Link>
            </Button>
            <Button asChild>
              <Link href={`/tracks/${track.id}/graph`}>Open in graph</Link>
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Provider genres</dt>
          <dd className="mt-1 text-sm">
            {track.genres.length ? track.genres.map((genre) => genre.name).join(", ") : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Subgenres</dt>
          <dd className="mt-1 text-sm">
            {track.subgenres.length ? track.subgenres.map((item) => item.name).join(", ") : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Folders</dt>
          <dd className="mt-1 text-sm">
            {track.folders.length
              ? track.folders
                  .map((item) => (item.kind ? `${item.name} (${item.kind})` : item.name))
                  .join(", ")
              : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Duration</dt>
          <dd className="mt-1 text-sm">{formatDuration(track.durationSec) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Release</dt>
          <dd className="mt-1 text-sm">{track.releaseDate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">BPM / key</dt>
          <dd className="mt-1 text-sm">
            {track.bpm ?? "—"} / {track.musicalKey ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">External IDs</dt>
          <dd className="mt-1 font-mono text-sm">
            {Object.keys(track.externalIds).length
              ? Object.entries(track.externalIds)
                  .map(([provider, id]) => `${provider}:${id}`)
                  .join(", ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Transitions</dt>
          <dd className="mt-1 text-sm">
            Outbound: {track.hasOutboundTransitions ? "yes" : "no"} · Inbound:{" "}
            {track.hasInboundTransitions ? "yes" : "no"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
