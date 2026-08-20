import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveNoteMentions } from "./resolve-mentions";
import type { NoteProcessingPlan } from "./schema";
import type { NoteAgentServices, TrackCandidate } from "./services";

function plan(): NoteProcessingPlan {
  return {
    noteType: "transition",
    confidence: "high",
    ambiguities: [],
    bidirectional: false,
    mentions: [
      {
        mentionId: "m1",
        mention: "levels avicii",
        titleHint: null,
        artistHint: null,
        selectedCandidateId: null,
        resolutionStatus: "unresolved",
        confidence: null,
        ambiguityReason: null,
      },
      {
        mentionId: "m2",
        mention: "love someone prospa",
        titleHint: null,
        artistHint: null,
        selectedCandidateId: null,
        resolutionStatus: "unresolved",
        confidence: null,
        ambiguityReason: null,
      },
    ],
    transitions: [
      {
        fromMentionId: "m1",
        toMentionId: "m2",
        fromBar: null,
        toBar: null,
        barsOverlap: null,
        technique: null,
        intent: null,
        quality: null,
        notes: null,
      },
    ],
  };
}

type ResolveServices = Pick<
  NoteAgentServices,
  "searchLibraryTracks" | "searchSpotifyTracks" | "findLibraryTrackByExternalId"
>;

function withExternalLookup(
  partial: Omit<ResolveServices, "findLibraryTrackByExternalId" | "searchLibraryTracks"> &
    Partial<Pick<ResolveServices, "findLibraryTrackByExternalId" | "searchLibraryTracks">>,
): ResolveServices {
  return {
    searchLibraryTracks: async () => ({ results: [] }),
    findLibraryTrackByExternalId: async () => null,
    ...partial,
  };
}

describe("resolveNoteMentions", () => {
  it("takes the top Spotify hit for each query", async () => {
    const services = withExternalLookup({
      searchSpotifyTracks: async () => ({
        results: [
          {
            mentionId: "m1",
            query: "levels avicii",
            candidates: [
              {
                handle: "spotify:levels",
                title: "Levels",
                artists: ["Avicii"],
                provider: "spotify",
                providerId: "levels",
              },
            ],
          },
          {
            mentionId: "m2",
            query: "love someone prospa",
            candidates: [
              {
                handle: "spotify:a",
                title: "Love Someone",
                artists: ["Prospa"],
                provider: "spotify",
                providerId: "a",
              },
              {
                handle: "spotify:b",
                title: "Love Someone (Edit)",
                artists: ["Prospa"],
                provider: "spotify",
                providerId: "b",
              },
            ],
          },
        ],
      }),
    });

    const result = await resolveNoteMentions({ plan: plan(), services });
    assert.equal(result.plan.mentions[0]?.selectedCandidateId, "spotify:levels");
    assert.equal(result.plan.mentions[0]?.resolutionStatus, "catalog_match");
    assert.equal(result.plan.mentions[1]?.selectedCandidateId, "spotify:a");
    assert.equal(result.plan.mentions[1]?.resolutionStatus, "catalog_match");
  });

  it("reuses an existing graph Track when Spotify id already exists", async () => {
    const existing: TrackCandidate = {
      handle: "graph:existing",
      title: "Love Someone (Alt Title)",
      artists: ["Prospa"],
      trackId: "existing",
      provider: "graph",
      providerId: "sp1",
    };
    const services = withExternalLookup({
      searchSpotifyTracks: async () => ({
        results: [
          {
            mentionId: "m1",
            query: "levels avicii",
            candidates: [
              {
                handle: "spotify:levels",
                title: "Levels",
                artists: ["Avicii"],
                providerId: "levels",
              },
            ],
          },
          {
            mentionId: "m2",
            query: "love someone prospa",
            candidates: [
              {
                handle: "spotify:sp1",
                title: "Love Someone",
                artists: ["Prospa"],
                provider: "spotify",
                providerId: "sp1",
              },
            ],
          },
        ],
      }),
      findLibraryTrackByExternalId: async ({ providerId }) =>
        providerId === "sp1" ? existing : null,
    });

    const result = await resolveNoteMentions({ plan: plan(), services });
    assert.equal(result.plan.mentions[1]?.selectedCandidateId, "graph:existing");
    assert.equal(result.plan.mentions[1]?.resolutionStatus, "resolved");
    assert.equal(result.candidates.byHandle.get("graph:existing")?.trackId, "existing");
  });

  it("marks empty Spotify results as unresolved", async () => {
    const services = withExternalLookup({
      searchSpotifyTracks: async () => ({
        results: [
          { mentionId: "m1", query: "levels avicii", candidates: [] },
          { mentionId: "m2", query: "love someone prospa", candidates: [] },
        ],
      }),
    });

    const result = await resolveNoteMentions({ plan: plan(), services });
    assert.equal(result.plan.mentions[0]?.selectedCandidateId, null);
    assert.equal(result.plan.mentions[0]?.resolutionStatus, "unresolved");
    assert.equal(result.plan.mentions[1]?.resolutionStatus, "unresolved");
  });
});
