"use client";

import { useCallback, useState } from "react";

import { describeApiError } from "@/lib/api/errors";

export const DEFAULT_PAGE_SIZE = 50;

export type PageResult<T> = {
  items: T[];
  hasMore: boolean;
};

export function usePaginatedList<T>({
  pageSize = DEFAULT_PAGE_SIZE,
  fetchPage,
  resource,
}: {
  pageSize?: number;
  fetchPage: (params: { offset: number; limit: number }) => Promise<PageResult<T>>;
  resource: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const replace = useCallback((page: PageResult<T>) => {
    setItems(page.items);
    setHasMore(page.hasMore);
    setError(null);
    setLoadingMore(false);
  }, []);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPage({
        offset: items.length,
        limit: pageSize,
      });
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
  }, [fetchPage, items.length, pageSize, resource]);

  return { items, hasMore, loadMore, loadingMore, error, setError, replace };
}
