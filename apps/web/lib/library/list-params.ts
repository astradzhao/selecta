import type { SubmissionExtractionStatus } from "@/lib/submissions/api";

export type TrackListFilters = {
  query: string;
  subgenre: string;
  folder: string;
};

export type SubmissionListFilters = {
  query: string;
  status: "" | SubmissionExtractionStatus;
  needsReviewOnly: boolean;
};

/** Which side of the Library's dual transition sources the DJ wants to see. */
export type TransitionState = "all" | "confirmed" | "needs_review";

export type TransitionListFilters = {
  fromQuery: string;
  toQuery: string;
  state: TransitionState;
};

export type ListPage = {
  offset: number;
  limit: number;
};

export function trackListQuery(filters: TrackListFilters) {
  return {
    query: filters.query,
    subgenre: filters.subgenre,
    folder: filters.folder,
    limit: 100,
  };
}

export function submissionListQuery(filters: SubmissionListFilters, page: ListPage) {
  return {
    query: filters.query,
    status: filters.status || undefined,
    needsReview: filters.needsReviewOnly ? true : undefined,
    limit: page.limit,
    offset: page.offset,
  };
}

export function transitionListQuery(filters: TransitionListFilters, page: ListPage) {
  return {
    fromQuery: filters.fromQuery,
    toQuery: filters.toQuery,
    limit: page.limit,
    offset: page.offset,
  };
}
