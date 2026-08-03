"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { SearchIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";

import { ApiClientError, listSongs, type ApiSong } from "@/lib/api";
import { SongChips } from "@/components/songs/song-chips";

export function LibraryList() {
  const [query, setQuery] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [folder, setFolder] = useState("");
  const [songs, setSongs] = useState<ApiSong[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startLoad] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      startLoad(async () => {
        try {
          const response = await listSongs({
            query,
            subgenre,
            folder,
            limit: 100,
          });
          if (cancelled) return;
          setSongs(response.songs);
          setError(null);
        } catch (err) {
          if (cancelled) return;
          setSongs([]);
          setError(
            err instanceof ApiClientError
              ? err.message
              : "Failed to load library. Is the API running?",
          );
        }
      });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, subgenre, folder]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
          <p className="text-muted-foreground max-w-xl text-sm">
            Search imported songs. Filter by Subgenre and Folder independently.
          </p>
        </div>
        <Button asChild>
          <Link href="/songs/new">Add song</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Label htmlFor="library-q" className="sr-only">
            Search
          </Label>
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="library-q"
            className="pl-10"
            placeholder="Title or artist"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-subgenre">Subgenre</Label>
          <Input
            id="filter-subgenre"
            placeholder="e.g. UKG"
            value={subgenre}
            onChange={(event) => setSubgenre(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filter-folder">Folder</Label>
          <Input
            id="filter-folder"
            placeholder="e.g. sunset set"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
          />
        </div>
      </div>

      {pending ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
      {error ? (
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">{error}</p>
      ) : null}

      <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
        {songs.map((song) => (
          <li key={song.id}>
            <Link
              href={`/songs/${song.id}`}
              className="hover:bg-muted/50 flex items-center gap-3 px-3 py-3 transition-colors"
            >
              <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md">
                {song.artworkUrl ? (
                  <Image src={song.artworkUrl} alt="" fill className="object-cover" sizes="48px" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div>
                  <p className="truncate font-medium">{song.title}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {song.artists.map((artist) => artist.name).join(", ") || "Unknown artist"}
                  </p>
                </div>
                <SongChips subgenres={song.subgenres} folders={song.folders} />
              </div>
            </Link>
          </li>
        ))}
        {!pending && !error && songs.length === 0 ? (
          <li className="text-muted-foreground px-3 py-8 text-sm">
            No songs yet.{" "}
            <Link href="/songs/new" className="text-foreground underline-offset-4 hover:underline">
              Add your first track
            </Link>
            .
          </li>
        ) : null}
      </ul>
    </div>
  );
}
