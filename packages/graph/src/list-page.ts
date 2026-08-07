/**
 * Shared list pagination helpers for Library APIs (DJ-72).
 */

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export function clampListLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(limit)));
}

export function clampListOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset)) {
    return 0;
  }
  return Math.max(0, Math.floor(offset));
}

export type ListPageMeta = {
  limit: number;
  offset: number;
  hasMore: boolean;
};
