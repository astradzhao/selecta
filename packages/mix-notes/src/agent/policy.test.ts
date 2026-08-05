import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateNoteProcessingPolicy } from "./policy";
import type { NoteMentionPlan, NoteProcessingPlan, NoteTransitionPlan } from "./schema";
import type { TrackCandidate } from "./services";
import { validateNoteProcessingPlan } from "./validate-plan";

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

function spotifyCandidate(id: string, title: string, artists: string[]): TrackCandidate {
  return {
    handle: `spotify:${id}`,
    title,
    artists,
    provider: "spotify",
    providerId: id,
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

describe("evaluateNoteProcessingPolicy", () => {
  it("returns no_proposal when there are no transitions", () => {
    const result = evaluateNoteProcessingPolicy({
      plan: plan({ noteType: "song_note", confidence: 0.99 }),
      candidatesByHandle: new Map(),
    });
    assert.equal(result.decision, "no_proposal");
  });

  it("does not auto-commit on high confidence alone", () => {
    const result = evaluateNoteProcessingPolicy({
      plan: plan({
        noteType: "transition",
        confidence: 0.99,
        mentions: [
          mention({
            mentionId: "m1",
            mention: "Levels",
            titleHint: "Levels",
            artistHint: "Avicii",
            resolutionStatus: "unresolved",
          }),
          mention({
            mentionId: "m2",
            mention: "Love Someone",
            titleHint: "Love Someone",
            artistHint: "Prospa",
            resolutionStatus: "unresolved",
          }),
        ],
        transitions: [transition({ fromMentionId: "m1", toMentionId: "m2" })],
      }),
      candidatesByHandle: new Map(),
    });
    assert.equal(result.decision, "needs_review");
    assert.ok(result.reasons.some((reason) => reason.code === "unresolved_endpoint"));
  });

  it("rejects invented candidate handles", () => {
    const result = evaluateNoteProcessingPolicy({
      plan: plan({
        noteType: "transition",
        confidence: 0.95,
        mentions: [
          mention({
            mentionId: "m1",
            mention: "Levels",
            titleHint: "Levels",
            artistHint: "Avicii",
            selectedCandidateId: "spotify:invented",
            resolutionStatus: "catalog_match",
          }),
          mention({
            mentionId: "m2",
            mention: "Love Someone",
            titleHint: "Love Someone",
            artistHint: "Prospa",
            selectedCandidateId: "graph:real",
            resolutionStatus: "resolved",
          }),
        ],
        transitions: [transition({ fromMentionId: "m1", toMentionId: "m2" })],
      }),
      candidatesByHandle: new Map([
        ["graph:real", graphCandidate("real", "Love Someone", ["Prospa"])],
      ]),
    });
    assert.equal(result.decision, "needs_review");
    assert.ok(result.reasons.some((reason) => reason.code === "invented_candidate"));
  });

  it("auto-commits unique local + unique Spotify import under gates", () => {
    const local = graphCandidate("t1", "Levels", ["Avicii"]);
    const remote = spotifyCandidate("sp1", "Love Someone", ["Prospa"]);
    const candidatesByHandle = new Map([
      [local.handle, local],
      [remote.handle, remote],
    ]);
    const candidatesByMentionId = new Map([
      ["m1", [local]],
      ["m2", [remote]],
    ]);

    const result = evaluateNoteProcessingPolicy({
      plan: plan({
        noteType: "transition",
        confidence: 0.95,
        mentions: [
          mention({
            mentionId: "m1",
            mention: "levels - avicii",
            titleHint: "Levels",
            artistHint: "Avicii",
            selectedCandidateId: local.handle,
            resolutionStatus: "resolved",
          }),
          mention({
            mentionId: "m2",
            mention: "love someone - prospa",
            titleHint: "Love Someone",
            artistHint: "Prospa",
            selectedCandidateId: remote.handle,
            resolutionStatus: "catalog_match",
          }),
        ],
        transitions: [
          transition({ fromMentionId: "m1", toMentionId: "m2", fromBar: 32, toBar: 40 }),
        ],
      }),
      candidatesByHandle,
      candidatesByMentionId,
    });

    assert.equal(result.decision, "auto_commit");
    assert.equal(result.imports.length, 1);
    assert.equal(result.imports[0]?.providerId, "sp1");
    assert.equal(result.commits.length, 1);
    assert.equal(result.resolvedTrackIdsByMention.m1, "t1");
  });

  it("accepts tied Spotify peers by preferring the selected top hit", () => {
    const a = spotifyCandidate("a", "Love Someone", ["Prospa"]);
    const b = spotifyCandidate("b", "Love Someone", ["Prospa"]);
    const result = evaluateNoteProcessingPolicy({
      plan: plan({
        noteType: "transition",
        confidence: 0.95,
        mentions: [
          mention({
            mentionId: "m1",
            mention: "Levels",
            titleHint: "Levels",
            artistHint: "Avicii",
            selectedCandidateId: "graph:t1",
            resolutionStatus: "resolved",
          }),
          mention({
            mentionId: "m2",
            mention: "Love Someone",
            titleHint: "Love Someone",
            artistHint: "Prospa",
            selectedCandidateId: a.handle,
            resolutionStatus: "catalog_match",
          }),
        ],
        transitions: [transition({ fromMentionId: "m1", toMentionId: "m2" })],
      }),
      candidatesByHandle: new Map([
        ["graph:t1", graphCandidate("t1", "Levels", ["Avicii"])],
        [a.handle, a],
        [b.handle, b],
      ]),
      candidatesByMentionId: new Map([
        ["m1", [graphCandidate("t1", "Levels", ["Avicii"])]],
        ["m2", [a, b]],
      ]),
    });
    assert.equal(result.decision, "auto_commit");
    assert.equal(result.imports[0]?.providerId, "a");
  });

  it("sends near-tied Spotify peers to needs_review", () => {
    const a = spotifyCandidate("a", "Love Someone (Edit)", ["Prospa"]);
    const b = spotifyCandidate("b", "Love Someone", ["Prospa Band"]);
    const result = evaluateNoteProcessingPolicy({
      plan: plan({
        noteType: "transition",
        confidence: 0.95,
        mentions: [
          mention({
            mentionId: "m1",
            mention: "Levels",
            titleHint: "Levels",
            artistHint: "Avicii",
            selectedCandidateId: "graph:t1",
            resolutionStatus: "resolved",
          }),
          mention({
            mentionId: "m2",
            mention: "Love Someone",
            titleHint: "Love Someone",
            artistHint: "Prospa",
            selectedCandidateId: a.handle,
            resolutionStatus: "catalog_match",
          }),
        ],
        transitions: [transition({ fromMentionId: "m1", toMentionId: "m2" })],
      }),
      candidatesByHandle: new Map([
        ["graph:t1", graphCandidate("t1", "Levels", ["Avicii"])],
        [a.handle, a],
        [b.handle, b],
      ]),
      candidatesByMentionId: new Map([
        ["m1", [graphCandidate("t1", "Levels", ["Avicii"])]],
        ["m2", [a, b]],
      ]),
    });
    assert.equal(result.decision, "needs_review");
    assert.ok(result.reasons.some((reason) => reason.code === "ambiguous_match"));
  });
});

describe("validateNoteProcessingPlan", () => {
  it("rejects unknown candidate handles and invalid endpoints", () => {
    const result = validateNoteProcessingPlan({
      plan: plan({
        noteType: "transition",
        confidence: 0.9,
        mentions: [
          mention({
            mentionId: "m1",
            mention: "x",
            selectedCandidateId: "spotify:missing",
            resolutionStatus: "catalog_match",
          }),
        ],
        transitions: [transition({ fromMentionId: "m1", toMentionId: "m2" })],
      }),
      candidatesByHandle: new Map(),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.code === "unknown_candidate"));
    assert.ok(result.issues.some((issue) => issue.code === "invalid_endpoint"));
  });

  it("rejects stale extraction versions", () => {
    const result = validateNoteProcessingPlan({
      plan: plan({ noteType: "unknown", confidence: 0.5 }),
      candidatesByHandle: new Map(),
      expectedExtractionVersion: 1,
      actualExtractionVersion: 2,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.issues.some((issue) => issue.code === "stale_version"));
  });
});
