import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateProposalPolicy } from "./proposal-policy";
import type { NoteMentionPlan, NoteProcessingPlan, NoteTransitionPlan } from "./schema";
import type { TrackCandidate } from "./services";

function mention(
  partial: Pick<NoteMentionPlan, "mentionId" | "mention" | "resolutionStatus"> &
    Partial<NoteMentionPlan>,
): NoteMentionPlan {
  return {
    titleHint: null,
    artistHint: null,
    selectedCandidateId: null,
    confidence: null,
    ambiguityReason: null,
    ...partial,
  };
}

function transition(
  partial: Pick<NoteTransitionPlan, "fromMentionId" | "toMentionId"> & Partial<NoteTransitionPlan>,
): NoteTransitionPlan {
  return {
    fromBar: null,
    toBar: null,
    barsOverlap: null,
    technique: null,
    intent: null,
    quality: null,
    notes: null,
    ...partial,
  };
}

function plan(
  partial: Partial<NoteProcessingPlan> & Pick<NoteProcessingPlan, "noteType" | "confidence">,
): NoteProcessingPlan {
  return {
    mentions: [],
    transitions: [],
    ambiguities: [],
    ...partial,
  };
}

function graphCandidate(id: string, title: string, artists: string[]): TrackCandidate {
  return {
    handle: `graph:${id}`,
    title,
    artists,
    trackId: id,
    provider: "graph",
  };
}

describe("evaluateProposalPolicy", () => {
  it("auto-commits a clear single proposal", () => {
    const from = graphCandidate("t1", "Levels", ["Avicii"]);
    const to = graphCandidate("t2", "Love Someone", ["Prospa"]);
    const result = evaluateProposalPolicy({
      plan: plan({
        noteType: "transition",
        confidence: 0.95,
        mentions: [
          mention({
            mentionId: "m1",
            mention: "Levels",
            titleHint: "Levels",
            artistHint: "Avicii",
            selectedCandidateId: from.handle,
            resolutionStatus: "resolved",
          }),
          mention({
            mentionId: "m2",
            mention: "Love Someone",
            titleHint: "Love Someone",
            artistHint: "Prospa",
            selectedCandidateId: to.handle,
            resolutionStatus: "resolved",
          }),
        ],
        transitions: [transition({ fromMentionId: "m1", toMentionId: "m2" })],
      }),
      candidatesByHandle: new Map([
        [from.handle, from],
        [to.handle, to],
      ]),
      candidatesByMentionId: new Map([
        ["m1", [from]],
        ["m2", [to]],
      ]),
    });

    assert.equal(result.decision, "auto_commit");
    assert.ok(result.commit);
    assert.equal(result.commit?.fromTrackId, "t1");
    assert.equal(result.commit?.toTrackId, "t2");
  });

  it("sends ambiguous proposals to needs_review without inventing commits", () => {
    const result = evaluateProposalPolicy({
      plan: plan({
        noteType: "transition",
        confidence: 0.95,
        ambiguities: ["unclear to track"],
        mentions: [
          mention({
            mentionId: "m1",
            mention: "Levels",
            resolutionStatus: "ambiguous",
          }),
          mention({
            mentionId: "m2",
            mention: "Something",
            resolutionStatus: "unresolved",
          }),
        ],
        transitions: [transition({ fromMentionId: "m1", toMentionId: "m2" })],
      }),
      candidatesByHandle: new Map(),
    });

    assert.equal(result.decision, "needs_review");
    assert.equal(result.commit, null);
  });
});
