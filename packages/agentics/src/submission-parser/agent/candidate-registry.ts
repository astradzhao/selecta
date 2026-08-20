import type { TrackCandidate } from "./services";
import type { NoteAgentServices, SearchCandidatesOutput, SearchQueriesInput } from "./services";

/**
 * Collects tool-returned candidates so policy can reject invented handles.
 */
export class CandidateRegistry {
  readonly byHandle = new Map<string, TrackCandidate>();
  readonly byMentionId = new Map<string, TrackCandidate[]>();

  ingest(output: SearchCandidatesOutput): void {
    for (const result of output.results) {
      const list = this.byMentionId.get(result.mentionId) ?? [];
      for (const candidate of result.candidates) {
        this.byHandle.set(candidate.handle, candidate);
        if (!list.some((item) => item.handle === candidate.handle)) {
          list.push(candidate);
        }
      }
      this.byMentionId.set(result.mentionId, list);
    }
  }
}

/** Wrap services so every search result is recorded for provenance checks. */
export function withCandidateRegistry(
  services: NoteAgentServices,
  registry: CandidateRegistry,
): NoteAgentServices {
  return {
    ...services,
    searchLibraryTracks: async (input: SearchQueriesInput) => {
      const output = await services.searchLibraryTracks(input);
      registry.ingest(output);
      return output;
    },
    searchSpotifyTracks: async (input: SearchQueriesInput) => {
      const output = await services.searchSpotifyTracks(input);
      registry.ingest(output);
      return output;
    },
  };
}
