import type { ApiNamedNode } from "@/lib/tracks/types";

export type NoteStatus = "draft" | "preview" | "committed";

export type NoteExtractionStatus =
  | "idle"
  | "extracting"
  | "no_proposal"
  | "resolving"
  | "needs_review"
  | "committed"
  | "partially_committed"
  | "commit_failed"
  | "failed";

export type ApiNoteTrackLink = {
  id: string;
  trackId: string;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  track: {
    id: string;
    title: string;
    artists: ApiNamedNode[];
    artworkUrl: string | null;
  } | null;
};

export type ApiNote = {
  id: string;
  rawText: string;
  status: NoteStatus;
  extractionStatus: NoteExtractionStatus;
  extractionVersion: number;
  extractionError: string | null;
  extractionConfidence: number | null;
  extractionStartedAt: string | null;
  extractionFinishedAt: string | null;
  extraction: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  rawResponse: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  trackLinks?: ApiNoteTrackLink[];
};
