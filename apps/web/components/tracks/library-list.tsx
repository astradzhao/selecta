"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@selecta/ui/components/button";
import { DataListRow } from "@selecta/ui/components/data-list";
import { Input } from "@selecta/ui/components/input";
import { SearchField } from "@selecta/ui/components/search-field";

import {
  ClearFiltersButton,
  FilterField,
  FilteredListShell,
} from "@/components/common/filtered-list-shell";
import { TrackChips } from "@/components/tracks/track-chips";
import { useFilteredList } from "@/hooks/use-filtered-list";
import { artistLine } from "@/lib/format";
import {
  fetchLibraryListIfStale,
  libraryCacheKey,
  previewLibraryList,
  readLibraryCache,
  sameTrackList,
} from "@/lib/library-cache";
import { formatListCount } from "@/lib/library/list-view-state";
import type { TrackListFilters } from "@/lib/library/list-params";

const EMPTY_FILTERS: TrackListFilters = { query: "", subgenre: "", folder: "" };

export function LibraryList() {
  const [query, setQuery] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [folder, setFolder] = useState("");
  const filters = useMemo(() => ({ query, subgenre, folder }), [query, subgenre, folder]);
  const hasFilters = Boolean(query || subgenre || folder);
  const initialCached = readLibraryCache(libraryCacheKey(EMPTY_FILTERS));

  const fetchPage = useCallback(
    async (next: TrackListFilters) => fetchLibraryListIfStale(next),
    [],
  );

  const list = useFilteredList({
    filters,
    fetchPage,
    resource: "library",
    pageSize: 100,
    previewItems: previewLibraryList,
    sameItems: sameTrackList,
    initialItems: initialCached?.tracks ?? [],
    initialHasFetched: initialCached != null,
    clearItemsOnError: false,
  });

  return (
    <FilteredListShell
      filtersAriaLabel="Library filters"
      listAriaLabel="Tracks"
      filterGridClassName="md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)]"
      filterControls={
        <>
          <FilterField htmlFor="library-q" label="Search">
            <SearchField
              id="library-q"
              placeholder="Title or artist"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </FilterField>
          <FilterField htmlFor="filter-subgenre" label="Subgenre">
            <Input
              id="filter-subgenre"
              placeholder="e.g. UKG"
              value={subgenre}
              onChange={(event) => setSubgenre(event.target.value)}
            />
          </FilterField>
          <FilterField htmlFor="filter-folder" label="Folder">
            <Input
              id="filter-folder"
              placeholder="e.g. sunset set"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            />
          </FilterField>
        </>
      }
      count={
        list.isInitialLoading
          ? "Loading library…"
          : list.error
            ? null
            : formatListCount(list.items.length, { singular: "track", plural: "tracks" })
      }
      toolbar={
        hasFilters ? (
          <ClearFiltersButton
            onClick={() => {
              setQuery("");
              setSubgenre("");
              setFolder("");
            }}
          />
        ) : null
      }
      unavailableTitle="Library unavailable"
      loadingAriaLabel="Loading library"
      error={list.error}
      hasFetched={list.hasFetched}
      hasFilters={hasFilters}
      items={list.items}
      getItemKey={(track) => track.id}
      renderRow={(track) => (
        <DataListRow className="items-center gap-3">
          <Link href={`/tracks/${track.id}`}>
            <div className="bg-muted relative size-12 shrink-0 overflow-hidden rounded-md">
              {track.artworkUrl ? (
                <Image src={track.artworkUrl} alt="" fill className="object-cover" sizes="48px" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div>
                <p className="text-card-title truncate">{track.title}</p>
                <p className="text-muted-foreground truncate text-sm">
                  {artistLine(track.artists)}
                </p>
              </div>
              <TrackChips subgenres={track.subgenres} />
            </div>
          </Link>
        </DataListRow>
      )}
      empty={{
        noneTitle: "No tracks yet",
        noneDescription: "Add a track to start building your library.",
        filteredTitle: "No matching tracks",
        action: (
          <Button asChild size="sm">
            <Link href="/add">Add your first track</Link>
          </Button>
        ),
      }}
      errorBanner={false}
    />
  );
}
