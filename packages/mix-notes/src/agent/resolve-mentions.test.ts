import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveNoteMentions } from "./resolve-mentions";
import type { NoteProcessingPlan } from "./schema";
import type { NoteAgentServices, TrackCandidate } from "./services";

function plan(): NoteProcessingPlan {
  return {
    noteType: "transition",
    confidence: 0.95,
    ambiguities: [],
    mentions: [
      {
        mentionId: "m1",
        mention: "levels - avicii",
        titleHint: "Levels",
        artistHint: "Avicii",
        selectedCandidateId: null,
        resolutionStatus: "unresolved",
        confidence: null,
        ambiguityReason: null,
      },
      {
        mentionId: "m2",
        mention: "love someone - prospa",
        titleHint: "Love Someone",
        artistHint: "Prospa",
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
        fromBar: 32,
        toBar: 40,
        barsOverlap: null,
        technique: null,
        intent: null,
        quality: null,
        notes: null,
      },
    ],
  };
}

describe("resolveNoteMentions", () => {
  it("prefers a unique local library hit over Spotify", async () => {
    const local: TrackCandidate = {
      handle: "graph:t1",
      title: "Levels",
      artists: ["Avicii"],
      trackId: "t1",
      provider: "graph",
    };
    const services: Pick<NoteAgentServices, "searchLibraryTracks" | "searchSpotifyTracks"> = {
      searchLibraryTracks: async () => ({
        results: [
          { mentionId: "m1", query: "Levels Avicii", candidates: [local] },
          { mentionId: "m2", query: "Love Someone Prospa", candidates: [] },
        ],
      }),
      searchSpotifyTracks: async () => ({
        results: [
          {
            mentionId: "m2",
            query: "Love Someone Prospa",
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
    };

    const result = await resolveNoteMentions({ plan: plan(), services });
    assert.equal(result.plan.mentions[0]?.selectedCandidateId, "graph:t1");
    assert.equal(result.plan.mentions[0]?.resolutionStatus, "resolved");
    assert.equal(result.plan.mentions[1]?.selectedCandidateId, "spotify:sp1");
    assert.equal(result.plan.mentions[1]?.resolutionStatus, "catalog_match");
  });

  it("picks the top Spotify hit when peers tie on score", async () => {
    const services: Pick<NoteAgentServices, "searchLibraryTracks" | "searchSpotifyTracks"> = {
      searchLibraryTracks: async () => ({
        results: [
          { mentionId: "m1", query: "x", candidates: [] },
          { mentionId: "m2", query: "y", candidates: [] },
        ],
      }),
      searchSpotifyTracks: async () => ({
        results: [
          {
            mentionId: "m2",
            query: "Love Someone Prospa",
            candidates: [
              {
                handle: "spotify:a",
                title: "Love Someone",
                artists: ["Prospa"],
                providerId: "a",
              },
              {
                handle: "spotify:b",
                title: "Love Someone",
                artists: ["Prospa"],
                providerId: "b",
              },
            ],
          },
        ],
      }),
    };

    const result = await resolveNoteMentions({ plan: plan(), services });
    assert.equal(result.plan.mentions[1]?.selectedCandidateId, "spotify:a");
    assert.equal(result.plan.mentions[1]?.resolutionStatus, "catalog_match");
  });

  it("marks near-tied different scores as ambiguous", async () => {
    const services: Pick<NoteAgentServices, "searchLibraryTracks" | "searchSpotifyTracks"> = {
      searchLibraryTracks: async () => ({
        results: [
          { mentionId: "m1", query: "x", candidates: [] },
          { mentionId: "m2", query: "y", candidates: [] },
        ],
      }),
      searchSpotifyTracks: async () => ({
        results: [
          {
            mentionId: "m2",
            query: "Love Someone Prospa",
            candidates: [
              {
                handle: "spotify:a",
                title: "Love Someone (Edit)",
                artists: ["Prospa"],
                providerId: "a",
              },
              {
                handle: "spotify:b",
                title: "Love Someone",
                artists: ["Prospa Band"],
                providerId: "b",
              },
            ],
          },
        ],
      }),
    };

    const result = await resolveNoteMentions({ plan: plan(), services });
    assert.equal(result.plan.mentions[1]?.selectedCandidateId, null);
    assert.equal(result.plan.mentions[1]?.resolutionStatus, "ambiguous");
  });
});
