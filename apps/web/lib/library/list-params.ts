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

export type TransitionListFilters = {
  query: string;
  technique: string;
  intent: string;
  source: "" | "manual" | "ai";
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
    query: filters.query,
    technique: filters.technique,
    intent: filters.intent,
    source: filters.source || undefined,
    limit: page.limit,
    offset: page.offset,
  };
}
