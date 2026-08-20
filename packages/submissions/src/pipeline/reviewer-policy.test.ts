import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertReviewerEndpoint,
  buildReviewerPolicyResult,
  type ReviewerEndpoint,
} from "./reviewer-policy";
import type { SubmissionProcessingPlan } from "@selecta/agentics/submission-parser";

function basePlan(): SubmissionProcessingPlan {
  return {
    noteType: "transition",
    confidence: "moderate",
    ambiguities: [],
    bidirectional: false,
    mentions: [
      {
        mentionId: "from",
        mention: "Track A",
        titleHint: null,
        artistHint: null,
        selectedCandidateId: null,
        resolutionStatus: "unresolved",
        confidence: null,
        ambiguityReason: null,
      },
      {
        mentionId: "to",
        mention: "Track B",
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
        fromMentionId: "from",
        toMentionId: "to",
        fromBar: 64,
        toBar: 1,
        barsOverlap: 16,
        technique: "echo out",
        intent: "energy",
        quality: "ok",
        notes: null,
      },
    ],
  };
}

describe("buildReviewerPolicyResult", () => {
  it("refuses free-text endpoints", () => {
    assert.throws(
      () =>
        buildReviewerPolicyResult({
          plan: basePlan(),
          from: { kind: "free_text", text: "anything" } as unknown as ReviewerEndpoint,
          to: { kind: "track", trackId: "track-b" },
        }),
      /free-text endpoints are not allowed/,
    );
    assert.throws(
      () => assertReviewerEndpoint({ kind: "label", name: "foo" }, "from"),
      /must be kind "track" or "spotify"/,
    );
  });

  it("maps track endpoints to resolved ids and spotify to imports", () => {
    const result = buildReviewerPolicyResult({
      plan: basePlan(),
      from: { kind: "track", trackId: "track-a" },
      to: {
        kind: "spotify",
        providerId: "spotify:abc",
        title: "Track B",
        artists: ["Artist"],
      },
    });

    assert.equal(result.decision, "auto_commit");
    assert.equal(result.resolvedTrackIdsByMention.from, "track-a");
    assert.equal(result.imports.length, 1);
    assert.equal(result.imports[0]?.mentionId, "to");
    assert.equal(result.imports[0]?.providerId, "spotify:abc");
    assert.equal(result.commit?.fromMentionId, "from");
    assert.equal(result.commit?.toMentionId, "to");
  });
});
