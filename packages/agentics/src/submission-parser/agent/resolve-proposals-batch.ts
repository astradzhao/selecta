import { CandidateRegistry } from "./candidate-registry";
import { SUBMISSION_LIMITS } from "./limits";
import { mentionSearchQuery, topSearchHit } from "./match";
import type { SubmissionMentionPlan, SubmissionProcessingPlan } from "./schema";
import type { CandidateSearchPort, SearchQueriesInput, TrackCandidate } from "./services";

export type ProposalResolveItem = {
  proposalId: string;
  proposalKey: string;
  plan: SubmissionProcessingPlan;
};

export type ResolveProposalsBatchInput = {
  items: ProposalResolveItem[];
  services: CandidateSearchPort;
  batchSize?: number;
};

export type ResolvedProposalItem = {
  proposalId: string;
  proposalKey: string;
  plan: SubmissionProcessingPlan;
  candidatesByHandle: Map<string, TrackCandidate>;
  candidatesByMentionId: Map<string, TrackCandidate[]>;
};

export type ResolveProposalsBatchResult = {
  items: ResolvedProposalItem[];
  /** Deduplicated query count before expansion to mentions. */
  uniqueQueryCount: number;
  searchBatchCount: number;
};

type PendingMention = {
  proposalId: string;
  mention: SubmissionMentionPlan;
  query: string;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Deduplicate mention search queries across proposals, then batch Spotify resolve.
 * Each proposal gets its own resolved plan + candidate maps.
 * Selection rule: take the top Spotify hit (catalog ranking).
 */
export async function resolveProposalsBatch(
  input: ResolveProposalsBatchInput,
): Promise<ResolveProposalsBatchResult> {
  const batchSize = input.batchSize ?? SUBMISSION_LIMITS.resolveBatchSize;
  const plans = new Map(
    input.items.map((item) => [item.proposalId, structuredClone(item.plan)] as const),
  );
  const registries = new Map<string, CandidateRegistry>();
  for (const item of input.items) {
    registries.set(item.proposalId, new CandidateRegistry());
  }

  const pending: PendingMention[] = [];
  const seenQueryKeys = new Set<string>();
  let uniqueQueryCount = 0;

  for (const item of input.items) {
    const plan = plans.get(item.proposalId)!;
    for (const mention of plan.mentions) {
      const query = mentionSearchQuery(mention).slice(0, 200);
      if (!query) continue;
      const key = query.toLowerCase();
      if (!seenQueryKeys.has(key)) {
        seenQueryKeys.add(key);
        uniqueQueryCount += 1;
      }
      pending.push({ proposalId: item.proposalId, mention, query });
    }
  }

  const searchMentions = pending.map((item, index) => ({
    ...item,
    searchId: `p${index}`,
  }));

  let searchBatchCount = 0;

  async function runSearch(
    searchFn: (input: SearchQueriesInput) => Promise<{
      results: Array<{ mentionId: string; query: string; candidates: TrackCandidate[] }>;
    }>,
    targets: typeof searchMentions,
  ) {
    for (const group of chunk(targets, batchSize)) {
      searchBatchCount += 1;
      const response = await searchFn({
        queries: group.map((item) => ({
          mentionId: item.searchId,
          query: item.query,
        })),
      });
      for (const result of response.results) {
        const target = group.find((item) => item.searchId === result.mentionId);
        if (!target) continue;
        const registry = registries.get(target.proposalId)!;
        registry.ingest({
          results: [
            {
              mentionId: target.mention.mentionId,
              query: result.query,
              candidates: result.candidates,
            },
          ],
        });
      }
    }
  }

  await runSearch(input.services.searchSpotifyTracks, searchMentions);

  for (const target of searchMentions) {
    const plan = plans.get(target.proposalId)!;
    const mention = plan.mentions.find((m) => m.mentionId === target.mention.mentionId);
    if (!mention || mention.selectedCandidateId) continue;

    const registry = registries.get(target.proposalId)!;
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
            query: target.query,
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

  return {
    uniqueQueryCount,
    searchBatchCount,
    items: input.items.map((item) => {
      const registry = registries.get(item.proposalId)!;
      return {
        proposalId: item.proposalId,
        proposalKey: item.proposalKey,
        plan: plans.get(item.proposalId)!,
        candidatesByHandle: registry.byHandle,
        candidatesByMentionId: registry.byMentionId,
      };
    }),
  };
}
