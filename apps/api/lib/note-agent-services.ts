import { isCatalogConfigured, searchCatalog } from "@selecta/catalog";
import {
  commitTransitionProposal,
  createTrack,
  getTrackByExternalId,
  isNeo4jConfigured,
  listTracks,
} from "@selecta/graph";
import {
  graphCandidateHandle,
  spotifyCandidateHandle,
  type NoteAgentServices,
  type SearchCandidatesOutput,
  type SearchQueriesInput,
} from "@selecta/mix-notes";

function emptyResults(input: SearchQueriesInput): SearchCandidatesOutput {
  return {
    results: input.queries.map((query) => ({
      mentionId: query.mentionId,
      query: query.query,
      candidates: [],
    })),
  };
}

/**
 * Concrete adapters for note / submission processing.
 * Search is used by the deterministic resolver; mutations by the policy executor only.
 * Not exposed as LLM tools.
 */
export function createNoteAgentServices(): NoteAgentServices {
  return {
    searchLibraryTracks: async (input) => {
      if (!isNeo4jConfigured()) {
        return emptyResults(input);
      }
      const results = await Promise.all(
        input.queries.map(async ({ mentionId, query }) => {
          try {
            const hits = await listTracks({ query, limit: 5 });
            return {
              mentionId,
              query,
              candidates: hits.slice(0, 5).map((hit) => ({
                handle: graphCandidateHandle(hit.track.id),
                title: hit.track.title,
                artists: hit.artists.map((artist) => artist.name),
                durationMs:
                  hit.track.durationSec != null ? Math.round(hit.track.durationSec * 1000) : null,
                artworkUrl: hit.track.artworkUrl,
                trackId: hit.track.id,
                provider: "graph",
              })),
            };
          } catch (error) {
            console.error("searchLibraryTracks failed", error);
            return { mentionId, query, candidates: [] };
          }
        }),
      );
      return { results };
    },

    searchSpotifyTracks: async (input) => {
      if (!isCatalogConfigured()) {
        return emptyResults(input);
      }
      const results = await Promise.all(
        input.queries.map(async ({ mentionId, query }) => {
          try {
            const search = await searchCatalog(query, { limit: 5 });
            return {
              mentionId,
              query,
              candidates: search.results.slice(0, 5).map((track) => ({
                handle: spotifyCandidateHandle(track.providerId),
                title: track.title,
                artists: track.artists,
                durationMs: track.durationMs,
                artworkUrl: track.artworkUrl,
                provider: track.provider,
                providerId: track.providerId,
              })),
            };
          } catch (error) {
            console.error("searchSpotifyTracks failed", error);
            return { mentionId, query, candidates: [] };
          }
        }),
      );
      return { results };
    },

    findLibraryTrackByExternalId: async ({ provider, providerId }) => {
      if (!isNeo4jConfigured()) {
        return null;
      }
      try {
        const hit = await getTrackByExternalId(provider, providerId);
        if (!hit) return null;
        return {
          handle: graphCandidateHandle(hit.track.id),
          title: hit.track.title,
          artists: hit.artists.map((artist) => artist.name),
          durationMs:
            hit.track.durationSec != null ? Math.round(hit.track.durationSec * 1000) : null,
          artworkUrl: hit.track.artworkUrl,
          trackId: hit.track.id,
          provider: "graph",
          providerId,
        };
      } catch (error) {
        console.error("findLibraryTrackByExternalId failed", error);
        return null;
      }
    },

    importSpotifyTrack: async (input) => {
      const result = await createTrack({
        title: input.title,
        artists: input.artists,
        artworkUrl: input.artworkUrl ?? null,
        durationSec:
          input.durationMs != null && Number.isFinite(input.durationMs)
            ? input.durationMs / 1000
            : null,
        releaseDate: input.releaseDate ?? null,
        genres: input.genres ?? [],
        externalIds: { spotify: input.providerId },
      });
      return { trackId: result.track.id, created: result.created };
    },

    commitTransition: async (input) => {
      const result = await commitTransitionProposal(input);
      return { id: result.id, proposalKey: result.proposalKey, created: result.created };
    },
  };
}
