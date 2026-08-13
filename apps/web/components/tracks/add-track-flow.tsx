"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SearchIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { Separator } from "@selecta/ui/components/separator";

import { ApiClientError } from "@/lib/api/client";
import { searchCatalog, type CatalogTrack } from "@/lib/catalog/api";
import { createTrack } from "@/lib/tracks/api";
import { invalidateLibraryCache } from "@/lib/library-cache";
import { FolderTagEditor, type FolderTag } from "@/components/tracks/folder-tag-editor";
import { TagEditor, type TagItem } from "@/components/tracks/tag-editor";

type Mode = "search" | "review";

function formatDuration(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  const totalSec = Math.round(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function AddTrackFlow({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogTrack[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchPending, startSearch] = useTransition();
  const [savePending, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<CatalogTrack | null>(null);
  const [title, setTitle] = useState("");
  const [artistsText, setArtistsText] = useState("");
  const [genres, setGenres] = useState<TagItem[]>([]);
  const [subgenres, setSubgenres] = useState<TagItem[]>([]);
  const [folders, setFolders] = useState<FolderTag[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      startSearch(async () => {
        try {
          const response = await searchCatalog(trimmed);
          if (cancelled) return;
          setResults(response.results);
          setSearchError(null);
        } catch (error) {
          if (cancelled) return;
          setResults([]);
          if (error instanceof ApiClientError) {
            if (error.code === "provider_not_configured") {
              setSearchError(
                "Catalog search isn’t configured. Use manual entry, or set Spotify credentials on the API.",
              );
              return;
            }
            setSearchError(error.message);
            return;
          }
          setSearchError("Catalog search failed.");
        }
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const showResults = query.trim().length >= 2;
  const visibleResults = showResults ? results : [];
  const visibleSearchError = showResults ? searchError : null;

  function openReview(track: CatalogTrack | null) {
    setCatalog(track);
    setTitle(track?.title ?? "");
    setArtistsText(track?.artists.join(", ") ?? "");
    setGenres((track?.genres ?? []).filter(Boolean).map((name) => ({ name })));
    setSubgenres([]);
    setFolders([]);
    setSaveError(null);
    setMode("review");
  }

  function save() {
    const artists = artistsText
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!title.trim() || artists.length === 0) {
      setSaveError("Title and at least one artist are required.");
      return;
    }

    startSave(async () => {
      try {
        const response = await createTrack({
          ...(catalog
            ? {
                catalog: {
                  provider: catalog.provider,
                  providerId: catalog.providerId,
                  title: catalog.title,
                  artists: catalog.artists,
                  artworkUrl: catalog.artworkUrl,
                  durationMs: catalog.durationMs,
                  releaseDate: catalog.releaseDate,
                  genres: catalog.genres,
                },
              }
            : {}),
          title: title.trim(),
          artists,
          genres: genres.map((item) => item.name),
          subgenres: subgenres.map((item) => ({ name: item.name })),
          folders: folders.map((item) => ({
            name: item.name,
            kind: item.kind,
          })),
        });
        invalidateLibraryCache();
        router.push(`/tracks/${response.track.id}`);
        router.refresh();
      } catch (error) {
        setSaveError(error instanceof ApiClientError ? error.message : "Failed to save track.");
      }
    });
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-8"}>
      {embedded ? null : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
            Library intake
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Add track</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Search the catalog, review the hit, then tag with musical subgenres and organizational
            folders — separately.
          </p>
        </div>
      )}

      {mode === "search" ? (
        <section className="space-y-4">
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search track or artist"
              className="h-12 pl-10 text-base"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={() => openReview(null)}>
              Enter manually
            </Button>
            {searchPending ? (
              <span className="text-muted-foreground text-sm">Searching…</span>
            ) : null}
          </div>

          {visibleSearchError ? (
            <p className="border-border bg-surface-2 rounded-lg border px-3 py-2 text-sm">
              {visibleSearchError}
            </p>
          ) : null}

          <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {visibleResults.map((track) => (
              <li key={`${track.provider}:${track.providerId}`}>
                <button
                  type="button"
                  className="hover:bg-surface-2 flex w-full items-center gap-3 px-3 py-3 text-left transition-colors"
                  onClick={() => openReview(track)}
                >
                  <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md">
                    {track.artworkUrl ? (
                      <Image
                        src={track.artworkUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{track.title}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {track.artists.join(", ")}
                    </p>
                  </div>
                  <div className="text-muted-foreground hidden text-right text-xs sm:block">
                    <p>{formatDuration(track.durationMs) ?? "—"}</p>
                    <p>{track.releaseDate ?? track.provider}</p>
                  </div>
                </button>
              </li>
            ))}
            {!searchPending && showResults && visibleResults.length === 0 && !visibleSearchError ? (
              <li className="text-muted-foreground px-3 py-6 text-sm">
                No catalog hits. Try another query or enter the track manually.
              </li>
            ) : null}
          </ul>
        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">
                {catalog ? "Review catalog hit" : "Manual entry"}
              </h2>
              <p className="text-muted-foreground text-sm">
                Confirm details, then save into your local library.
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={() => setMode("search")}>
              Back to search
            </Button>
          </div>

          {catalog?.artworkUrl ? (
            <div className="bg-muted relative h-40 w-40 overflow-hidden rounded-xl">
              <Image src={catalog.artworkUrl} alt="" fill className="object-cover" sizes="160px" />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="artists">Artists</Label>
              <Input
                id="artists"
                value={artistsText}
                onChange={(event) => setArtistsText(event.target.value)}
                placeholder="Comma-separated"
              />
            </div>
          </div>

          <Separator />

          <TagEditor
            id="provider-genres"
            label="Catalog genres"
            hint="Broad labels from Spotify/catalog (e.g. electronic). Prefer Subgenres for how you actually mix."
            placeholder="Add catalog genre, then Enter — or pick one below"
            values={genres}
            onChange={setGenres}
            vocab="genres"
          />

          <TagEditor
            id="subgenres"
            label="Subgenres"
            hint="Your DJ mixing labels (UKG, melodic house, afro house…) — what Selecta filters and Graph care about."
            placeholder="Add subgenre, then Enter — or pick one below"
            values={subgenres}
            onChange={setSubgenres}
            badgeVariant="secondary"
            vocab="subgenres"
          />

          <FolderTagEditor values={folders} onChange={setFolders} />

          {saveError ? (
            <p className="border-destructive/30 bg-destructive-subtle text-destructive rounded-lg border px-3 py-2 text-sm">
              {saveError}
            </p>
          ) : null}

          <div className="flex gap-3">
            <Button type="button" onClick={save} disabled={savePending}>
              {savePending ? "Saving…" : "Save to library"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setMode("search")}>
              Cancel
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
