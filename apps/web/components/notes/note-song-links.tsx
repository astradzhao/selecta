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
  addNoteSongLink,
  listSongs,
  removeNoteSongLink,
  type ApiNoteSongLink,
  type ApiSong,
} from "@/lib/api";

export function NoteSongLinks({
  noteId,
  initialLinks,
  onLinksChange,
}: {
  noteId: string;
  initialLinks: ApiNoteSongLink[];
  onLinksChange?: (links: ApiNoteSongLink[]) => void;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiSong[]>([]);
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
          const response = await listSongs({ query: q, limit: 8 });
          if (cancelled) return;
          const linkedIds = new Set(links.map((link) => link.songId));
          setResults(response.songs.filter((song) => !linkedIds.has(song.id)));
          setError(null);
        } catch (err) {
          if (cancelled) return;
          setResults([]);
          setError(
            err instanceof ApiClientError
              ? err.code === "graph_not_configured"
                ? "The local song database isn’t running. Start the full stack with `pnpm dev`."
                : err.message
              : "Failed to search library songs.",
          );
        }
      });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, links]);

  function updateLinks(next: ApiNoteSongLink[]) {
    setLinks(next);
    onLinksChange?.(next);
  }

  function linkSong(song: ApiSong) {
    startMutate(async () => {
      try {
        const response = await addNoteSongLink(noteId, { songId: song.id });
        updateLinks(response.songLinks);
        setQuery("");
        setResults([]);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : "Failed to link song. Is the API running?",
        );
      }
    });
  }

  function unlinkSong(songId: string) {
    startMutate(async () => {
      try {
        const response = await removeNoteSongLink(noteId, songId);
        updateLinks(response.songLinks);
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Failed to unlink song. Is the API running?",
        );
      }
    });
  }

  return (
    <section aria-label="Linked songs" className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Linked songs</h2>
        <p className="text-muted-foreground text-sm">
          Optionally attach existing library songs. Links are manual — parsing never adds them
          silently.
        </p>
      </div>

      <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
        {links.map((link) => (
          <li key={link.id} className="flex items-center gap-3 px-4 py-3">
            <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-md">
              {link.song?.artworkUrl ? (
                <Image
                  src={link.song.artworkUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              {link.song ? (
                <>
                  <Link
                    href={`/songs/${link.song.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {link.song.title}
                  </Link>
                  <p className="text-muted-foreground truncate text-sm">
                    {link.song.artists.map((artist) => artist.name).join(", ") || "Unknown artist"}
                  </p>
                </>
              ) : (
                <>
                  <p className="truncate font-medium">Song unavailable</p>
                  <p className="text-muted-foreground truncate text-sm">{link.songId}</p>
                </>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={mutating}
              onClick={() => unlinkSong(link.songId)}
              aria-label={`Unlink ${link.song?.title ?? link.songId}`}
            >
              <XIcon />
              Remove
            </Button>
          </li>
        ))}
        {links.length === 0 ? (
          <li className="text-muted-foreground px-4 py-6 text-sm">No songs linked yet.</li>
        ) : null}
      </ul>

      <div className="space-y-2">
        <Label htmlFor="note-link-song-search">Add song from library</Label>
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="note-link-song-search"
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
            {results.map((song) => (
              <li key={song.id}>
                <button
                  type="button"
                  className="hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                  disabled={mutating}
                  onClick={() => linkSong(song)}
                >
                  <div className="bg-muted relative size-10 shrink-0 overflow-hidden rounded-md">
                    {song.artworkUrl ? (
                      <Image
                        src={song.artworkUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{song.title}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {song.artists.map((artist) => artist.name).join(", ") || "Unknown artist"}
                    </p>
                  </div>
                  <PlusIcon className="text-muted-foreground size-4 shrink-0" />
                </button>
              </li>
            ))}
            {results.length === 0 ? (
              <li className="text-muted-foreground px-4 py-5 text-sm">No matching songs.</li>
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
