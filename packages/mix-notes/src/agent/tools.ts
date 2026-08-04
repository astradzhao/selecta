import { tool, type Tool } from "ai";

import type { NoteAgentServices } from "./services";
import {
  SearchCandidatesOutputSchema,
  SearchQueriesInputSchema,
  type SearchCandidatesOutput,
  type SearchQueriesInput,
} from "./services";

type SearchTool = Tool<SearchQueriesInput, SearchCandidatesOutput>;

export function createSearchLibraryTracksTool(services: NoteAgentServices): SearchTool {
  return tool({
    description:
      "Search the local Neo4j DJ library for tracks matching mention queries. Returns up to 5 candidates per query with graph: handles.",
    inputSchema: SearchQueriesInputSchema,
    execute: async (input) => {
      const result = await services.searchLibraryTracks(input);
      return SearchCandidatesOutputSchema.parse(result);
    },
  });
}

export function createSearchSpotifyTracksTool(services: NoteAgentServices): SearchTool {
  return tool({
    description:
      "Search Spotify catalog for tracks matching mention queries. Returns up to 5 candidates per query with spotify: handles. Does not create tracks.",
    inputSchema: SearchQueriesInputSchema,
    execute: async (input) => {
      const result = await services.searchSpotifyTracks(input);
      return SearchCandidatesOutputSchema.parse(result);
    },
  });
}

export type NoteAgentToolSet = {
  searchLibraryTracks: SearchTool;
  searchSpotifyTracks: SearchTool;
};

export function createNoteAgentTools(services: NoteAgentServices): NoteAgentToolSet {
  return {
    searchLibraryTracks: createSearchLibraryTracksTool(services),
    searchSpotifyTracks: createSearchSpotifyTracksTool(services),
  };
}
