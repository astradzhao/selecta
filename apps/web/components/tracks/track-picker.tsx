"use client";

import { useState, type ReactNode } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { DataList, DataListRow } from "@selecta/ui/components/data-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@selecta/ui/components/dialog";
import { EmptyState } from "@selecta/ui/components/empty-state";
import { ListSkeleton } from "@selecta/ui/components/list-skeleton";
import { SearchField } from "@selecta/ui/components/search-field";
import { cn } from "@selecta/ui/lib/utils";

import {
  TrackRow,
  type TrackRowSelectedIndicator,
  type TrackRowSize,
} from "@/components/tracks/track-row";
import { useTrackSearch } from "@/hooks/use-track-search";
import type { CatalogTrack } from "@/lib/catalog/types";
import { shouldRunTrackSearch } from "@/lib/tracks/track-search";
import {
  rowFromApiTrack,
  rowFromCatalogTrack,
  type TrackRowItem,
} from "@/lib/tracks/track-row-item";
import type { ApiTrack } from "@/lib/tracks/api";

type BusyPresentation = "keep" | "hide" | "dim";

type TrackPickerShared = {
  query?: string;
  onQueryChange?: (query: string) => void;
  selectedKey?: string | null;
  disabled?: boolean;
  size?: TrackRowSize;
  selectedIndicator?: TrackRowSelectedIndicator;
  placeholder?: string;
  autoFocus?: boolean;
  searchClassName?: string;
  listClassName?: string;
  emptyFiltered?: string;
  emptyNone?: string;
  id?: string;
  "aria-label"?: string;
  leading?: ReactNode;
  showSearch?: boolean;
  enabled?: boolean;
  busy?: BusyPresentation;
};

type LibraryPickerProps = TrackPickerShared & {
  source: "library";
  onSelect: (track: ApiTrack) => void;
  limit?: number;
  minQueryLength?: number;
  searchWhenEmpty?: boolean;
  excludeIds?: readonly string[];
  interaction?: "select" | "add";
  badges?: (track: ApiTrack) => Array<string | null>;
  trailing?: (track: ApiTrack) => ReactNode;
};

type CatalogPickerProps = TrackPickerShared & {
  source: "catalog";
  onSelect: (track: CatalogTrack) => void;
  limit?: number;
  minQueryLength?: number;
  interaction?: "select" | "add";
  badges?: (track: CatalogTrack) => Array<string | null>;
  trailing?: (track: CatalogTrack) => ReactNode;
};

type ItemsPickerProps = TrackPickerShared & {
  source: "items";
  items: TrackRowItem[];
  onSelect: (item: TrackRowItem) => void;
  interaction?: "select" | "add";
  badges?: (item: TrackRowItem) => Array<string | null>;
  trailing?: (item: TrackRowItem) => ReactNode;
};

export type TrackPickerProps = LibraryPickerProps | CatalogPickerProps | ItemsPickerProps;

function TrackPickerSearch({
  id,
  query,
  onQueryChange,
  placeholder,
  autoFocus,
  disabled,
  searchClassName,
  ariaLabel,
}: {
  id?: string;
  query: string;
  onQueryChange: (query: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  disabled?: boolean;
  searchClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <SearchField
      id={id}
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      disabled={disabled}
      className={searchClassName}
      aria-label={ariaLabel}
    />
  );
}

function TrackPickerList({
  rows,
  size,
  interaction,
  selectedKey,
  selectedIndicator,
  disabled,
  onSelect,
  empty,
  showEmpty,
  listClassName,
  badges,
  trailing,
  dimmed,
}: {
  rows: TrackRowItem[];
  size: TrackRowSize;
  interaction: "select" | "add";
  selectedKey?: string | null;
  selectedIndicator: TrackRowSelectedIndicator;
  disabled?: boolean;
  onSelect: (key: string) => void;
  empty: string;
  showEmpty: boolean;
  listClassName?: string;
  badges?: (key: string) => Array<string | null>;
  trailing?: (key: string) => ReactNode;
  dimmed?: boolean;
}) {
  return (
    <DataList className={cn(dimmed && "opacity-70", listClassName)}>
      {rows.map((item) => {
        const itemBadges =
          badges?.(item.key)?.filter((badge): badge is string => Boolean(badge)) ?? [];
        return (
          <TrackRow
            key={item.key}
            item={item}
            size={size}
            interaction={interaction}
            selected={item.key === selectedKey}
            selectedIndicator={selectedIndicator}
            disabled={disabled}
            onSelect={() => onSelect(item.key)}
            trailing={trailing?.(item.key)}
          >
            {itemBadges.length > 0 ? (
              <span className="flex flex-wrap gap-1.5 pt-0.5">
                {itemBadges.map((badge) => (
                  <Badge key={badge} variant="secondary" className="font-normal">
                    {badge}
                  </Badge>
                ))}
              </span>
            ) : null}
          </TrackRow>
        );
      })}
      {showEmpty ? (
        <DataListRow interactive={false}>
          <EmptyState compact className="rounded-none border-0" title={empty} />
        </DataListRow>
      ) : null}
    </DataList>
  );
}

function UncontrolledQuery({
  value,
  onChange,
  children,
}: {
  value?: string;
  onChange?: (query: string) => void;
  children: (query: string, setQuery: (query: string) => void) => ReactNode;
}) {
  const [internal, setInternal] = useState(value ?? "");
  const query = onChange ? (value ?? "") : internal;
  const setQuery = onChange ?? setInternal;
  return <>{children(query, setQuery)}</>;
}

export function TrackPicker(props: TrackPickerProps) {
  const size = props.size ?? "md";
  const interaction = props.interaction ?? "select";
  const selectedIndicator =
    props.selectedIndicator ?? (interaction === "select" ? "check" : "none");
  const showSearch = props.showSearch ?? props.source !== "items";
  const enabled = props.enabled ?? true;
  const busy = props.busy ?? "keep";

  return (
    <UncontrolledQuery value={props.query} onChange={props.onQueryChange}>
      {(query, setQuery) => (
        <TrackPickerBody
          {...props}
          query={query}
          onQueryChange={setQuery}
          size={size}
          interaction={interaction}
          selectedIndicator={selectedIndicator}
          showSearch={showSearch}
          enabled={enabled}
          busy={busy}
        />
      )}
    </UncontrolledQuery>
  );
}

function TrackPickerBody(
  props: TrackPickerProps & {
    query: string;
    onQueryChange: (query: string) => void;
    size: TrackRowSize;
    interaction: "select" | "add";
    selectedIndicator: TrackRowSelectedIndicator;
    showSearch: boolean;
    enabled: boolean;
    busy: BusyPresentation;
  },
) {
  const minQueryLength =
    props.source === "items" ? 0 : (props.minQueryLength ?? (props.source === "catalog" ? 2 : 1));
  const searchWhenEmpty = props.source === "library" ? (props.searchWhenEmpty ?? false) : false;
  const limit =
    props.source === "items" ? 0 : (props.limit ?? (props.source === "catalog" ? 10 : 8));
  const excludeIds = props.source === "library" ? (props.excludeIds ?? []) : [];

  const search = useTrackSearch({
    source: props.source === "catalog" ? "catalog" : "library",
    query: props.query,
    enabled: props.enabled && props.source !== "items",
    limit,
    minQueryLength,
    searchWhenEmpty,
    excludeIds,
    resource: props.source === "catalog" ? "the catalog" : "library",
  });

  const active =
    props.source === "items" ||
    shouldRunTrackSearch(props.query, { minQueryLength, searchWhenEmpty });

  const rows: TrackRowItem[] =
    props.source === "items"
      ? props.items
      : props.source === "catalog"
        ? search.catalogTracks.map(rowFromCatalogTrack)
        : search.libraryTracks.map(rowFromApiTrack);

  const error = props.source === "items" ? null : search.error;
  const searching = props.source === "items" ? false : search.searching;
  const hasFetched = props.source === "items" ? true : search.hasFetched;
  const busy = props.busy;

  const hideList = busy === "hide" && searching;
  const showSkeleton = busy === "dim" && searching && !hasFetched;
  const dimmed = busy === "dim" && searching && hasFetched;
  const showEmpty =
    active && !searching && rows.length === 0 && !error && (hasFetched || props.source === "items");
  const emptyCopy = props.query.trim()
    ? (props.emptyFiltered ?? "No matching tracks.")
    : (props.emptyNone ?? "No tracks yet.");

  function selectKey(key: string) {
    if (props.source === "items") {
      const item = props.items.find((row) => row.key === key);
      if (item) props.onSelect(item);
      return;
    }
    if (props.source === "catalog") {
      const track = search.catalogTracks.find((row) => rowFromCatalogTrack(row).key === key);
      if (track) props.onSelect(track);
      return;
    }
    const track = search.libraryTracks.find((row) => row.id === key);
    if (track) props.onSelect(track);
  }

  function badgesForKey(key: string): Array<string | null> {
    if (!props.badges) return [];
    if (props.source === "items") {
      const item = props.items.find((row) => row.key === key);
      return item ? props.badges(item) : [];
    }
    if (props.source === "catalog") {
      const track = search.catalogTracks.find((row) => rowFromCatalogTrack(row).key === key);
      return track ? props.badges(track) : [];
    }
    const track = search.libraryTracks.find((row) => row.id === key);
    return track ? props.badges(track) : [];
  }

  function trailingForKey(key: string): ReactNode {
    if (!props.trailing) return null;
    if (props.source === "items") {
      const item = props.items.find((row) => row.key === key);
      return item ? props.trailing(item) : null;
    }
    if (props.source === "catalog") {
      const track = search.catalogTracks.find((row) => rowFromCatalogTrack(row).key === key);
      return track ? props.trailing(track) : null;
    }
    const track = search.libraryTracks.find((row) => row.id === key);
    return track ? props.trailing(track) : null;
  }

  return (
    <div className="space-y-3">
      {props.showSearch ? (
        <TrackPickerSearch
          id={props.id}
          query={props.query}
          onQueryChange={props.onQueryChange}
          placeholder={props.placeholder ?? "Search title or artist"}
          autoFocus={props.autoFocus}
          disabled={props.disabled}
          searchClassName={props.searchClassName}
          ariaLabel={props["aria-label"]}
        />
      ) : null}

      {props.leading || (searching && busy === "keep") ? (
        <div className="flex flex-wrap items-center gap-3">
          {props.leading}
          {searching && busy === "keep" ? (
            <span className="text-muted-foreground text-sm">Searching…</span>
          ) : null}
        </div>
      ) : null}

      {searching && busy === "hide" ? (
        <p className="text-caption" aria-live="polite">
          Searching library…
        </p>
      ) : null}

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {showSkeleton ? (
        <ListSkeleton rows={4} aria-label="Loading library" className="rounded-none border-0" />
      ) : hideList ? null : !active ? (
        props.source === "catalog" ? (
          <DataList />
        ) : null
      ) : (
        <TrackPickerList
          rows={rows}
          size={props.size}
          interaction={props.interaction}
          selectedKey={props.selectedKey}
          selectedIndicator={props.selectedIndicator}
          disabled={props.disabled}
          onSelect={selectKey}
          empty={emptyCopy}
          showEmpty={showEmpty}
          listClassName={props.listClassName}
          badges={props.badges ? badgesForKey : undefined}
          trailing={props.trailing ? trailingForKey : undefined}
          dimmed={dimmed}
        />
      )}
    </div>
  );
}

export function TrackPickerDialog({
  open,
  onOpenChange,
  onSelect,
  title = "Choose a starting track",
  description = "Search your library, then start the graph explorer from that song.",
  confirmLabel = "Start with this track",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (track: ApiTrack) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ApiTrack | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setSelected(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 duration-300 sm:max-w-lg">
        <DialogHeader className="gap-1.5 border-b px-5 py-4 pe-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          <TrackPicker
            source="library"
            query={query}
            onQueryChange={setQuery}
            enabled={open}
            searchWhenEmpty
            limit={40}
            minQueryLength={1}
            size="sm"
            selectedKey={selected?.id ?? null}
            selectedIndicator="radio"
            onSelect={setSelected}
            placeholder="Search title or artist…"
            autoFocus
            busy="dim"
            emptyNone="Your library is empty."
            emptyFiltered="No tracks match that search."
            listClassName="max-h-[min(50vh,22rem)] overflow-y-auto overflow-x-hidden"
          />
        </div>

        <DialogFooter className="m-0 gap-3 rounded-none border-t px-5 py-3.5 sm:items-center sm:justify-between">
          <p className="text-muted-foreground hidden text-xs sm:block">
            {selected ? `Selected: ${selected.title}` : "Select a track to continue"}
          </p>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onSelect(selected);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
