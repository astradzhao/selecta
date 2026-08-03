"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

import {
  ApiClientError,
  addNoteTrackLink,
  listTracks,
  removeNoteTrackLink,
  type ApiNoteTrackLink,
  type ApiTrack,
} from "@/lib/api";

export function NoteTrackLinks({
  noteId,
  initialLinks,
  onLinksChange,
}: {
  noteId: string;
  initialLinks: ApiNoteTrackLink[];
  onLinksChange?: (links: ApiNoteTrackLink[]) => void;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [mutating, startMutate] = useTransition();

  useEffect(() => {
    setLinks(initialLinks);
  }, [initialLinks]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      startSearch(async () => {
        try {
          const response = await listTracks({ query: q, limit: 8 });
          if (cancelled) return;
          const linkedIds = new Set(links.map((link) => link.trackId));
          setResults(response.tracks.filter((track) => !linkedIds.has(track.id)));
          setError(null);
        } catch (err) {
          if (cancelled) return;
          setResults([]);
          setError(
            err instanceof ApiClientError
              ? err.code === "graph_not_configured"
                ? "The local track database isn’t running. Start the full stack with `pnpm dev`."
                : err.message
              : "Failed to search library tracks.",
          );
        }
      });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, links]);

  function updateLinks(next: ApiNoteTrackLink[]) {
    setLinks(next);
    onLinksChange?.(next);
  }

  function linkTrack(track: ApiTrack) {
    startMutate(async () => {
      try {
        const response = await addNoteTrackLink(noteId, { trackId: track.id });
        updateLinks(response.trackLinks);
        setQuery("");
        setResults([]);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : "Failed to link track. Is the API running?",
        );
      }
    });
  }

  function unlinkTrack(trackId: string) {
    startMutate(async () => {
      try {
        const response = await removeNoteTrackLink(noteId, trackId);
        updateLinks(response.trackLinks);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to unlink track. Is the API running?",
        );
      }
    });
  }

  return (
    <section aria-label="Linked tracks" className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Linked tracks</h2>
        <p className="text-muted-foreground text-sm">
          Optionally attach existing library tracks. Links are manual — parsing never adds them
          silently.
        </p>
      </div>

      <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
        {links.map((link) => (
          <li key={link.id} className="flex items-center gap-3 px-4 py-3">
            <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-md">
              {link.track?.artworkUrl ? (
                <Image
                  src={link.track.artworkUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              {link.track ? (
                <>
                  <Link
                    href={`/tracks/${link.track.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {link.track.title}
                  </Link>
                  <p className="text-muted-foreground truncate text-sm">
                    {link.track.artists.map((artist) => artist.name).join(", ") || "Unknown artist"}
                  </p>
                </>
              ) : (
                <>
                  <p className="truncate font-medium">Track unavailable</p>
                  <p className="text-muted-foreground truncate text-sm">{link.trackId}</p>
                </>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={mutating}
              onClick={() => unlinkTrack(link.trackId)}
              aria-label={`Unlink ${link.track?.title ?? link.trackId}`}
            >
              <XIcon />
              Remove
            </Button>
          </li>
        ))}
        {links.length === 0 ? (
          <li className="text-muted-foreground px-4 py-6 text-sm">No tracks linked yet.</li>
        ) : null}
      </ul>

      <div className="space-y-2">
        <Label htmlFor="note-link-track-search">Add track from library</Label>
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="note-link-track-search"
            className="pl-10"
            placeholder="Search title or artist"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setError(null);
            }}
            disabled={mutating}
          />
        </div>
        {searching ? (
          <p className="text-muted-foreground text-xs" aria-live="polite">
            Searching library…
          </p>
        ) : null}
        {query.trim() && !searching ? (
          <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {results.map((track) => (
              <li key={track.id}>
                <button
                  type="button"
                  className="hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                  disabled={mutating}
                  onClick={() => linkTrack(track)}
                >
                  <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-md">
                    {track.artworkUrl ? (
                      <Image
                        src={track.artworkUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{track.title}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {track.artists.map((artist) => artist.name).join(", ") || "Unknown artist"}
                    </p>
                  </div>
                  <PlusIcon className="text-muted-foreground size-4 shrink-0" />
                </button>
              </li>
            ))}
            {results.length === 0 ? (
              <li className="text-muted-foreground px-4 py-5 text-sm">No matching tracks.</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
