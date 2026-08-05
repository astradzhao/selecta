import { CandidateRegistry } from "./candidate-registry";
import { mentionSearchQuery, uniqueBestCandidate } from "./match";
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
 * Deterministic mention resolution:
 * 1) fuzzy local library
 * 2) Spotify catalog
 * 3) exact graph lookup by Spotify external id (reuse existing Track)
 *
 * Never invents tracks — only attaches opaque handles from search/lookup results.
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

  const library = await input.services.searchLibraryTracks({ queries });
  registry.ingest(library);

  const needsSpotify: typeof queries = [];
  for (const mention of plan.mentions) {
    const peers = registry.byMentionId.get(mention.mentionId) ?? [];
    const unique = uniqueBestCandidate(mention, peers);
    if (unique?.trackId) {
      mention.selectedCandidateId = unique.handle;
      mention.resolutionStatus = "resolved";
      mention.ambiguityReason = null;
      continue;
    }
    if (peers.length > 1) {
      // Ambiguous locally — still try Spotify for a unique catalog match,
      // but keep local peers for policy margins.
    }
    needsSpotify.push({
      mentionId: mention.mentionId,
      query: mentionSearchQuery(mention).slice(0, 200),
    });
  }

  if (needsSpotify.length > 0) {
    const spotify = await input.services.searchSpotifyTracks({
      queries: needsSpotify.slice(0, maxMentions),
    });
    registry.ingest(spotify);

    for (const mention of plan.mentions) {
      if (mention.selectedCandidateId) continue;
      const peers = (registry.byMentionId.get(mention.mentionId) ?? []).filter((item) =>
        item.handle.startsWith("spotify:"),
      );
      const unique = uniqueBestCandidate(mention, peers);
      if (unique?.providerId) {
        // Fuzzy library search may have missed this Track; reuse by exact Spotify id.
        const existing = await input.services.findLibraryTrackByExternalId({
          provider: "spotify",
          providerId: unique.providerId,
        });
        if (existing?.trackId) {
          registry.ingest({
            results: [
              {
                mentionId: mention.mentionId,
                query: mentionSearchQuery(mention),
                candidates: [existing],
              },
            ],
          });
          mention.selectedCandidateId = existing.handle;
          mention.resolutionStatus = "resolved";
          mention.ambiguityReason = null;
          continue;
        }

        mention.selectedCandidateId = unique.handle;
        mention.resolutionStatus = "catalog_match";
        mention.ambiguityReason = null;
        continue;
      }
      if (peers.length > 1 || (registry.byMentionId.get(mention.mentionId)?.length ?? 0) > 1) {
        mention.resolutionStatus = "ambiguous";
        mention.ambiguityReason =
          mention.ambiguityReason ?? "Multiple close catalog/library matches.";
        mention.selectedCandidateId = null;
      } else {
        mention.resolutionStatus = "unresolved";
        mention.selectedCandidateId = null;
      }
    }
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
