import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ExtractionProposalSchema,
  parseExtractionProposal,
  safeParseExtractionProposal,
} from "./extraction-schema";

describe("ExtractionProposalSchema", () => {
  it("accepts unknown notes with no songs or transitions", () => {
    const result = parseExtractionProposal({
      noteType: "unknown",
      confidence: 0.1,
    });

    assert.deepEqual(result, {
      noteType: "unknown",
      songMentions: [],
      transitionProposals: [],
      confidence: 0.1,
      ambiguities: [],
    });
  });

  it("accepts song_note with mentions but no transition", () => {
    const result = parseExtractionProposal({
      noteType: "song_note",
      songMentions: [{ mention: "levels - avicii", titleHint: "Levels", artistHint: "Avicii" }],
      confidence: 0.8,
      ambiguities: [],
    });

    assert.equal(result.transitionProposals.length, 0);
    assert.equal(result.songMentions[0]?.mention, "levels - avicii");
    assert.equal(result.songMentions[0]?.resolvedId, undefined);
  });

  it("accepts partial transition fields and null bars", () => {
    const result = parseExtractionProposal({
      noteType: "transition",
      songMentions: [{ mention: "track A" }, { mention: "track B", resolvedId: null }],
      transitionProposals: [
        {
          fromMention: "track A",
          toMention: "track B",
          fromBar: 32,
          toBar: null,
          technique: "high_pass_filter",
          intent: "build_hype",
          quality: "great",
          notes: "works in the room",
        },
      ],
      confidence: 0.9,
      ambiguities: ["Which mix-out bar on track B?"],
    });

    assert.equal(result.transitionProposals[0]?.toBar, null);
    assert.equal(result.transitionProposals[0]?.barsOverlap, undefined);
    assert.equal(result.ambiguities.length, 1);
  });

  it("rejects invalid noteType", () => {
    const result = safeParseExtractionProposal({
      noteType: "cue",
      confidence: 0.5,
    });
    assert.equal(result.success, false);
  });

  it("rejects confidence outside 0–1", () => {
    assert.equal(
      safeParseExtractionProposal({ noteType: "mixed", confidence: 1.5 }).success,
      false,
    );
    assert.equal(
      safeParseExtractionProposal({ noteType: "mixed", confidence: -0.1 }).success,
      false,
    );
  });

  it("rejects empty song mention strings", () => {
    const result = ExtractionProposalSchema.safeParse({
      noteType: "song_note",
      songMentions: [{ mention: "" }],
      confidence: 0.5,
    });
    assert.equal(result.success, false);
  });
});
