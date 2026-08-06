import { CandidateRegistry } from "./candidate-registry";
import { mentionSearchQuery, mentionSpotifySearchQuery, topSearchHit } from "./match";
import type { NoteMentionPlan, NoteProcessingPlan } from "./schema";
import type { NoteAgentServices, TrackCandidate } from "./services";

export type ResolveMentionsInput = {
  plan: NoteProcessingPlan;
  services: Pick<
    NoteAgentServices,
    "searchLibraryTracks" | "searchSpotifyTracks" | "findLibraryTrackByExternalId"
  >;
  /** Max mentions to search in one batch (library + Spotify). */
  maxMentions?: number;
};

export type ResolveMentionsResult = {
  plan: NoteProcessingPlan;
  candidates: CandidateRegistry;
};

function batchQueries(mentions: NoteMentionPlan[], maxMentions: number) {
  return mentions.slice(0, maxMentions).map((mention) => ({
    mentionId: mention.mentionId,
    query: mentionSearchQuery(mention).slice(0, 200),
  }));
}

/**
 * Mention resolution:
 * 1) Spotify search with the parser query → take top hit
 * 2) Reuse an existing graph Track when that Spotify id is already imported
 *
 * No local title/artist scoring — trust the catalog ranker.
 */
export async function resolveNoteMentions(
  input: ResolveMentionsInput,
): Promise<ResolveMentionsResult> {
  const maxMentions = input.maxMentions ?? 4;
  const registry = new CandidateRegistry();
  const plan = structuredClone(input.plan);

  if (plan.mentions.length === 0) {
    return { plan, candidates: registry };
  }

  const queries = batchQueries(plan.mentions, maxMentions).filter((item) => item.query.length > 0);
  if (queries.length === 0) {
    return { plan, candidates: registry };
  }

  const spotify = await input.services.searchSpotifyTracks({
    queries: queries.slice(0, maxMentions),
  });
  registry.ingest(spotify);

  for (const mention of plan.mentions) {
    const peers = (registry.byMentionId.get(mention.mentionId) ?? []).filter((item) =>
      item.handle.startsWith("spotify:"),
    );
    const top = topSearchHit(peers);
    if (!top?.providerId) {
      mention.resolutionStatus = "unresolved";
      mention.selectedCandidateId = null;
      continue;
    }

    const existing = await input.services.findLibraryTrackByExternalId({
      provider: "spotify",
      providerId: top.providerId,
    });
    if (existing?.trackId) {
      registry.ingest({
        results: [
          {
            mentionId: mention.mentionId,
            query: mentionSpotifySearchQuery(mention),
            candidates: [existing],
          },
        ],
      });
      mention.selectedCandidateId = existing.handle;
      mention.resolutionStatus = "resolved";
      mention.ambiguityReason = null;
      continue;
    }

    mention.selectedCandidateId = top.handle;
    mention.resolutionStatus = "catalog_match";
    mention.ambiguityReason = null;
  }

  return { plan, candidates: registry };
}

/** Test helper: attach an already-known candidate map without searching. */
export function attachCandidatesForTests(
  plan: NoteProcessingPlan,
  candidatesByMentionId: Map<string, TrackCandidate[]>,
): ResolveMentionsResult {
  const registry = new CandidateRegistry();
  for (const [mentionId, candidates] of candidatesByMentionId) {
    registry.ingest({
      results: [
        {
          mentionId,
          query: mentionId,
          candidates,
        },
      ],
    });
  }
  return { plan, candidates: registry };
}
