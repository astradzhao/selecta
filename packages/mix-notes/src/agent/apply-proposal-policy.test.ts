import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyProposalPolicy } from "./apply-proposal-policy";
import type { ProposalPolicyResult } from "./proposal-policy";
import type { NoteProcessingPlan } from "./schema";
import type { NoteAgentServices } from "./services";

const plan: NoteProcessingPlan = {
  noteType: "transition",
  confidence: "high",
  ambiguities: [],
  bidirectional: false,
  mentions: [
    {
      mentionId: "m1",
      mention: "a",
      titleHint: "A",
      artistHint: "Artist",
      selectedCandidateId: "graph:t1",
      resolutionStatus: "resolved",
      confidence: null,
      ambiguityReason: null,
    },
    {
      mentionId: "m2",
      mention: "b",
      titleHint: "B",
      artistHint: "Artist",
      selectedCandidateId: "graph:t2",
      resolutionStatus: "resolved",
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

describe("applyProposalPolicy", () => {
  it("commits with fingerprint proposal keys independently", async () => {
    const commits: string[] = [];
    const services: NoteAgentServices = {
      searchLibraryTracks: async () => ({ results: [] }),
      searchSpotifyTracks: async () => ({ results: [] }),
      findLibraryTrackByExternalId: async () => null,
      importSpotifyTrack: async () => {
        throw new Error("should not import");
      },
      commitTransition: async (input) => {
        commits.push(input.proposalKey);
        return { proposalKey: input.proposalKey, created: true };
      },
    };

    const policy: ProposalPolicyResult = {
      decision: "auto_commit",
      reasons: [{ code: "ok", message: "ok" }],
      imports: [],
      commit: {
        transitionIndex: 0,
        fromMentionId: "m1",
        toMentionId: "m2",
        fromTrackId: "t1",
        toTrackId: "t2",
        transition: plan.transitions[0]!,
      },
      resolvedTrackIdsByMention: { m1: "t1", m2: "t2" },
    };

    const key = "note-1:2:span:abc123";
    const result = await applyProposalPolicy({
      plan,
      policy,
      services,
      noteId: "note-1",
      extractionVersion: 2,
      proposalKey: key,
    });

    assert.equal(result.committed, true);
    assert.deepEqual(commits, [key]);
  });

  it("commits both directions when bidirectional is true", async () => {
    const commits: string[] = [];
    const services: NoteAgentServices = {
      searchLibraryTracks: async () => ({ results: [] }),
      searchSpotifyTracks: async () => ({ results: [] }),
      findLibraryTrackByExternalId: async () => null,
      importSpotifyTrack: async () => {
        throw new Error("should not import");
      },
      commitTransition: async (input) => {
        commits.push(`${input.proposalKey}:${input.fromTrackId}->${input.toTrackId}`);
        return { proposalKey: input.proposalKey, created: true };
      },
    };

    const policy: ProposalPolicyResult = {
      decision: "auto_commit",
      reasons: [{ code: "ok", message: "ok" }],
      imports: [],
      commit: {
        transitionIndex: 0,
        fromMentionId: "m1",
        toMentionId: "m2",
        fromTrackId: "t1",
        toTrackId: "t2",
        transition: plan.transitions[0]!,
      },
      resolvedTrackIdsByMention: { m1: "t1", m2: "t2" },
    };

    const key = "note-1:2:span:pair";
    const result = await applyProposalPolicy({
      plan: { ...plan, bidirectional: true },
      policy,
      services,
      noteId: "note-1",
      extractionVersion: 2,
      proposalKey: key,
    });

    assert.equal(result.committed, true);
    assert.deepEqual(commits, [`${key}:t1->t2`, `${key}:rev:t2->t1`]);
  });

  it("does not commit when a sibling-style needs_review decision is applied", async () => {
    let commitCalls = 0;
    const services: NoteAgentServices = {
      searchLibraryTracks: async () => ({ results: [] }),
      searchSpotifyTracks: async () => ({ results: [] }),
      findLibraryTrackByExternalId: async () => null,
      importSpotifyTrack: async () => ({ trackId: "x", created: true }),
      commitTransition: async () => {
        commitCalls += 1;
        return { proposalKey: "x", created: true };
      },
    };

    const result = await applyProposalPolicy({
      plan,
      policy: {
        decision: "needs_review",
        reasons: [{ code: "ambiguous_match", message: "ambiguous" }],
        imports: [],
        commit: null,
        resolvedTrackIdsByMention: {},
      },
      services,
      noteId: "note-1",
      extractionVersion: 1,
      proposalKey: "note-1:1:span:zzz",
    });

    assert.equal(result.committed, false);
    assert.equal(commitCalls, 0);
  });
});
