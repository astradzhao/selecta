"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { SectionHeading } from "@selecta/ui/components/section-heading";
import { Separator } from "@selecta/ui/components/separator";

import { TagEditor, type FolderTag, type TagItem } from "@/components/tracks/tag-editor";
import { TrackPicker } from "@/components/tracks/track-picker";
import { describeApiError } from "@/lib/api/errors";
import type { CatalogTrack } from "@/lib/catalog/types";
import { formatDuration } from "@/lib/format";
import { invalidateLibraryCache } from "@/lib/library-cache";
import { createTrack } from "@/lib/tracks/api";

type Mode = "search" | "review";

export function AddTrackFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [savePending, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<CatalogTrack | null>(null);
  const [title, setTitle] = useState("");
  const [artistsText, setArtistsText] = useState("");
  const [genres, setGenres] = useState<TagItem[]>([]);
  const [subgenres, setSubgenres] = useState<TagItem[]>([]);
  const [folders, setFolders] = useState<FolderTag[]>([]);

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
        setSaveError(describeApiError(error, { fallback: "Failed to save track." }));
      }
    });
  }

  return (
    <div className="space-y-6">
      {mode === "search" ? (
        <section className="space-y-4">
          <TrackPicker
            source="catalog"
            query={query}
            onQueryChange={setQuery}
            minQueryLength={2}
            limit={10}
            size="md"
            autoFocus
            searchClassName="h-12 text-base"
            placeholder="Search track or artist"
            emptyFiltered="No catalog hits. Try another query or enter the track manually."
            leading={
              <Button type="button" variant="outline" onClick={() => openReview(null)}>
                Enter manually
              </Button>
            }
            onSelect={openReview}
            trailing={(track) => (
              <div className="text-numeric text-muted-foreground hidden text-right text-xs sm:block">
                <p>{formatDuration(track.durationMs, "milliseconds") ?? "—"}</p>
                <p>{track.releaseDate ?? track.provider}</p>
              </div>
            )}
          />
        </section>
      ) : (
        <section className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <SectionHeading
              title={catalog ? "Review catalog hit" : "Manual entry"}
              hint="Confirm details, then save into your local library."
            />
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

          <TagEditor
            kind
            label="Folders / playlists"
            hint="Organizational buckets for sets and crates — separate from musical Subgenres."
            placeholder="Add playlist or folder, then Enter — or pick one below"
            values={folders}
            onChange={setFolders}
          />

          {saveError ? <Alert variant="destructive">{saveError}</Alert> : null}

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
