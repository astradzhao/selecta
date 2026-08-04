import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyNoteProcessingPolicy } from "./apply-policy";
import type { PolicyResult } from "./policy";
import type { NoteProcessingPlan } from "./schema";
import type { NoteAgentServices } from "./services";

const plan: NoteProcessingPlan = {
  noteType: "transition",
  confidence: 0.95,
  ambiguities: [],
  mentions: [
    {
      mentionId: "m1",
      mention: "a",
      titleHint: "A",
      artistHint: "Artist",
      selectedCandidateId: "spotify:1",
      resolutionStatus: "catalog_match",
    },
    {
      mentionId: "m2",
      mention: "b",
      titleHint: "B",
      artistHint: "Artist",
      selectedCandidateId: "spotify:2",
      resolutionStatus: "catalog_match",
    },
  ],
  transitions: [{ fromMentionId: "m1", toMentionId: "m2" }],
};

describe("applyNoteProcessingPolicy", () => {
  it("imports Spotify matches and commits with deterministic proposal keys", async () => {
    const imports: string[] = [];
    const commits: string[] = [];
    const services: NoteAgentServices = {
      searchLibraryTracks: async () => ({ results: [] }),
      searchSpotifyTracks: async () => ({ results: [] }),
      importSpotifyTrack: async (input) => {
        imports.push(input.providerId);
        return { trackId: `track-${input.providerId}`, created: true };
      },
      commitTransition: async (input) => {
        commits.push(input.proposalKey);
        return { proposalKey: input.proposalKey, created: true };
      },
    };

    const policy: PolicyResult = {
      decision: "auto_commit",
      reasons: [{ code: "ok", message: "ok" }],
      imports: [
        {
          mentionId: "m1",
          providerId: "1",
          title: "A",
          artists: ["Artist"],
          candidate: {
            handle: "spotify:1",
            title: "A",
            artists: ["Artist"],
            providerId: "1",
          },
        },
        {
          mentionId: "m2",
          providerId: "2",
          title: "B",
          artists: ["Artist"],
          candidate: {
            handle: "spotify:2",
            title: "B",
            artists: ["Artist"],
            providerId: "2",
          },
        },
      ],
      commits: [
        {
          transitionIndex: 0,
          fromMentionId: "m1",
          toMentionId: "m2",
          fromTrackId: "",
          toTrackId: "",
          transition: plan.transitions[0]!,
        },
      ],
      resolvedTrackIdsByMention: {},
    };

    const result = await applyNoteProcessingPolicy({
      plan,
      policy,
      services,
      noteId: "note-1",
      extractionVersion: 3,
    });

    assert.equal(result.decision, "auto_commit");
    assert.deepEqual(imports, ["1", "2"]);
    assert.deepEqual(result.committedProposalKeys, ["note-1:3:0"]);
    assert.deepEqual(commits, ["note-1:3:0"]);
  });

  it("does not invent free-text tracks when decision is needs_review", async () => {
    let importCalls = 0;
    const services: NoteAgentServices = {
      searchLibraryTracks: async () => ({ results: [] }),
      searchSpotifyTracks: async () => ({ results: [] }),
      importSpotifyTrack: async () => {
        importCalls += 1;
        return { trackId: "x", created: true };
      },
      commitTransition: async () => {
        throw new Error("should not commit");
      },
    };

    const result = await applyNoteProcessingPolicy({
      plan,
      policy: {
        decision: "needs_review",
        reasons: [{ code: "ambiguous_match", message: "ambiguous" }],
        imports: [],
        commits: [],
        resolvedTrackIdsByMention: {},
      },
      services,
      noteId: "note-1",
      extractionVersion: 1,
    });

    assert.equal(result.decision, "needs_review");
    assert.equal(importCalls, 0);
    assert.deepEqual(result.committedProposalKeys, []);
  });
});
