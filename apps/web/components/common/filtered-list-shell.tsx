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
      {/* text-xs is repeated so tailwind-merge drops Label's text-sm; text-eyebrow is opaque to it. */}
      <FieldLabel htmlFor={htmlFor} className="text-eyebrow text-xs">
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
    <div className="space-y-6">
      <section
        aria-label={filtersAriaLabel}
        className="border-border bg-surface-1 space-y-3 rounded-xl border px-4 py-4"
      >
        <div className={cn("grid items-end gap-3", filterGridClassName)}>{filterControls}</div>
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
          <ListSkeleton aria-label={loadingAriaLabel} />
        ) : (
          <div className={cn(leading ? "space-y-6" : "space-y-3")}>
            {leading}
            {hideMainList ? null : (
              <div className="space-y-3">
                {listHeading}
                <DataList>
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pagination.loadingMore}
                    onClick={() => pagination.onLoadMore()}
                  >
                    {pagination.loadingMore ? "Loading…" : "Load more"}
                  </Button>
                ) : null}
              </div>
            )}
            {errorBanner && error ? <Alert variant="destructive">{error}</Alert> : null}
          </div>
        )}
      </section>
    </div>
  );
}
