import { z } from "zod";

export const TrackCandidateSchema = z.object({
  handle: z.string().min(1),
  title: z.string().min(1),
  artists: z.array(z.string()),
  durationMs: z.number().nullable().optional(),
  artworkUrl: z.string().nullable().optional(),
  provider: z.string().optional(),
  providerId: z.string().optional(),
  trackId: z.string().optional(),
});
export type TrackCandidate = z.infer<typeof TrackCandidateSchema>;

export const SearchQueriesInputSchema = z.object({
  queries: z
    .array(
      z.object({
        mentionId: z.string().min(1),
        query: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(16),
});
export type SearchQueriesInput = z.infer<typeof SearchQueriesInputSchema>;

export const SearchCandidatesOutputSchema = z.object({
  results: z.array(
    z.object({
      mentionId: z.string(),
      query: z.string(),
      candidates: z.array(TrackCandidateSchema).max(5),
    }),
  ),
});
export type SearchCandidatesOutput = z.infer<typeof SearchCandidatesOutputSchema>;

export type NoteAgentServices = {
  searchLibraryTracks: (input: SearchQueriesInput) => Promise<SearchCandidatesOutput>;
  searchSpotifyTracks: (input: SearchQueriesInput) => Promise<SearchCandidatesOutput>;
  /**
   * Exact library lookup by catalog external id (e.g. Spotify).
   * Used after a Spotify hit to reuse an existing Track node.
   */
  findLibraryTrackByExternalId: (input: {
    provider: string;
    providerId: string;
  }) => Promise<TrackCandidate | null>;
  /** Deterministic import — never exposed as an LLM tool. */
  importSpotifyTrack: (input: {
    providerId: string;
    title: string;
    artists: string[];
    artworkUrl?: string | null;
    durationMs?: number | null;
    releaseDate?: string | null;
    genres?: string[];
  }) => Promise<{ trackId: string; created: boolean }>;
  /** Deterministic commit — never exposed as an LLM tool. */
  commitTransition: (input: {
    fromTrackId: string;
    toTrackId: string;
    proposalKey: string;
    sourceNoteId: string;
    sourceNoteVersion: number;
    confidence?: number | null;
    fromBar?: number | null;
    toBar?: number | null;
    barsOverlap?: number | null;
    technique?: string | null;
    intent?: string | null;
    quality?: string | null;
    notes?: string | null;
  }) => Promise<{ proposalKey: string; created: boolean }>;
};
