"use client";

import { Fragment, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { DataList, DataListRow } from "@selecta/ui/components/data-list";
import { EmptyState } from "@selecta/ui/components/empty-state";
import { Field, FieldLabel } from "@selecta/ui/components/field";
import { ListSkeleton } from "@selecta/ui/components/list-skeleton";
import { StatePanel } from "@selecta/ui/components/state-panel";
import { cn } from "@selecta/ui/lib/utils";

import { emptyStateCopy, listViewPhase } from "@/lib/library/list-view-state";

export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      <XIcon />
      Clear filters
    </Button>
  );
}

export function FilterField({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={htmlFor} className="sr-only">
        {label}
      </FieldLabel>
      {children}
    </Field>
  );
}

export function FilteredListShell<T>({
  filtersAriaLabel,
  listAriaLabel,
  filterGridClassName,
  filterControls,
  filterBar,
  count,
  toolbar,
  showCountRow,
  unavailableTitle,
  loadingAriaLabel,
  error,
  hasFetched,
  hasFilters,
  items,
  getItemKey,
  renderRow,
  empty,
  leading,
  hideMainList = false,
  listHeading,
  pagination,
  errorBanner = true,
  hasContent,
}: {
  filtersAriaLabel: string;
  listAriaLabel: string;
  filterGridClassName: string;
  filterControls: ReactNode;
  filterBar?: ReactNode;
  count: ReactNode;
  toolbar?: ReactNode;
  showCountRow?: boolean;
  unavailableTitle: string;
  loadingAriaLabel: string;
  error: string | null;
  hasFetched: boolean;
  hasFilters: boolean;
  items: T[];
  getItemKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  empty: {
    noneTitle: string;
    noneDescription: string;
    filteredTitle: string;
    action?: ReactNode;
  };
  leading?: ReactNode;
  hideMainList?: boolean;
  listHeading?: ReactNode;
  pagination?: {
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
  };
  errorBanner?: boolean;
  hasContent?: boolean;
}) {
  const content = hasContent ?? items.length > 0;
  const phase = listViewPhase({
    hasFetched,
    error,
    hasContent: content,
  });
  const countRowVisible = showCountRow ?? (!error || hasFilters || Boolean(toolbar));
  const emptyCopy = emptyStateCopy(hasFilters, empty);

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <section
        aria-label={filtersAriaLabel}
        className="bg-surface-1 space-y-2 border-b px-2.5 py-2.5"
      >
        <div className={cn("grid items-center gap-2", filterGridClassName)}>{filterControls}</div>
        {filterBar}
        {countRowVisible ? (
          <div className="flex min-h-7 items-center justify-between gap-4">
            <p className="text-caption" aria-live="polite">
              {count}
            </p>
            {toolbar}
          </div>
        ) : null}
      </section>

      <section aria-label={listAriaLabel}>
        {phase === "error" ? (
          <StatePanel variant="error" title={unavailableTitle} description={error} />
        ) : phase === "loading" ? (
          <ListSkeleton aria-label={loadingAriaLabel} className="rounded-none border-0" />
        ) : (
          <>
            {leading ? <div className="border-border border-b px-3.5 py-4">{leading}</div> : null}
            {hideMainList ? null : (
              <>
                {listHeading}
                <DataList className="rounded-none border-0">
                  {items.map((item) => (
                    <Fragment key={getItemKey(item)}>{renderRow(item)}</Fragment>
                  ))}
                  {hasFetched && items.length === 0 ? (
                    <DataListRow interactive={false}>
                      <EmptyState title={emptyCopy.title} description={emptyCopy.description}>
                        {emptyCopy.showAction ? empty.action : null}
                      </EmptyState>
                    </DataListRow>
                  ) : null}
                </DataList>
                {pagination?.hasMore ? (
                  <div className="px-3.5 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pagination.loadingMore}
                      onClick={() => pagination.onLoadMore()}
                    >
                      {pagination.loadingMore ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
            {errorBanner && error ? (
              <div className="px-3.5 py-3">
                <Alert variant="destructive">{error}</Alert>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
