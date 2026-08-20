"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { DEFAULT_PAGE_SIZE } from "@/hooks/use-paginated-list";
import { describeApiError } from "@/lib/api/errors";

export type FilteredListPage = {
  offset: number;
  limit: number;
};

export type FilteredListPageResult<T> = {
  items: T[];
  hasMore: boolean;
  skipReplace?: boolean;
};

export function useFilteredList<T, F>({
  filters,
  fetchPage,
  resource,
  pageSize = DEFAULT_PAGE_SIZE,
  pagination = false,
  previewItems,
  sameItems,
  initialItems = [],
  initialHasFetched = false,
  clearItemsOnError = true,
}: {
  filters: F;
  fetchPage: (
    filters: F,
    page: FilteredListPage,
    ctx: { items: T[] },
  ) => Promise<FilteredListPageResult<T>>;
  resource: string;
  pageSize?: number;
  pagination?: boolean;
  previewItems?: (filters: F) => T[] | null;
  sameItems?: (a: T[], b: T[]) => boolean;
  initialItems?: T[];
  initialHasFetched?: boolean;
  clearItemsOnError?: boolean;
}) {
  const debouncedFilters = useDebouncedValue(filters);
  const [items, setItems] = useState<T[]>(initialItems);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(initialHasFetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const itemsRef = useRef(items);
  const fetchPageRef = useRef(fetchPage);
  const previewItemsRef = useRef(previewItems);
  const sameItemsRef = useRef(sameItems);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    fetchPageRef.current = fetchPage;
    previewItemsRef.current = previewItems;
    sameItemsRef.current = sameItems;
  }, [fetchPage, previewItems, sameItems]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const preview = previewItemsRef.current?.(debouncedFilters) ?? null;
      if (cancelled) return;
      const baseline = preview ?? itemsRef.current;
      const sameItems = sameItemsRef.current;
      if (preview) {
        setItems((current) => (sameItems?.(current, preview) ? current : preview));
        setError(null);
        setHasFetched(true);
      }

      try {
        const page = await fetchPageRef.current(
          debouncedFilters,
          { offset: 0, limit: pageSize },
          { items: baseline },
        );
        if (cancelled) return;
        if (page.skipReplace) {
          setHasFetched(true);
          return;
        }
        setItems((current) => (sameItems?.(current, page.items) ? current : page.items));
        setHasMore(page.hasMore);
        setError(null);
        setHasFetched(true);
      } catch (err) {
        if (cancelled) return;
        if (clearItemsOnError) {
          setItems([]);
          setHasMore(false);
        }
        setError(describeApiError(err, { resource }));
        setHasFetched(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, pageSize, resource, clearItemsOnError]);

  const loadMore = useCallback(async () => {
    if (!pagination) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(
        debouncedFilters,
        { offset: items.length, limit: pageSize },
        { items },
      );
      setItems((current) => [...current, ...page.items]);
      setHasMore(page.hasMore);
      setError(null);
    } catch (err) {
      setError(
        describeApiError(err, {
          fallback: `Failed to load more ${resource}. Is the API running?`,
        }),
      );
    } finally {
      setLoadingMore(false);
    }
  }, [pagination, fetchPage, debouncedFilters, items, pageSize, resource]);

  return {
    items,
    hasMore,
    error,
    hasFetched,
    isInitialLoading: !hasFetched && !error,
    loadMore,
    loadingMore,
  };
}
