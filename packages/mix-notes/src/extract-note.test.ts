import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasTransitionProposals, providerFromModel } from "./extract-note";
import { parseExtractionProposal } from "./extraction-schema";

describe("extract-note helpers", () => {
  it("derives provider from AI Gateway model ids", () => {
    assert.equal(providerFromModel("openai/gpt-4.1-mini"), "openai");
    assert.equal(providerFromModel("anthropic/claude-sonnet-4.5"), "anthropic");
    assert.equal(providerFromModel("no-slash"), "unknown");
  });

  it("treats unknown and song-only notes as no transition proposals", () => {
    const unknown = parseExtractionProposal({
      noteType: "unknown",
      confidence: 0.9,
    });
    assert.equal(hasTransitionProposals(unknown), false);

    const songNote = parseExtractionProposal({
      noteType: "song_note",
      songMentions: [{ mention: "levels - avicii" }],
      confidence: 0.7,
    });
    assert.equal(hasTransitionProposals(songNote), false);

    const transition = parseExtractionProposal({
      noteType: "transition",
      songMentions: [{ mention: "a" }, { mention: "b" }],
      transitionProposals: [{ fromMention: "a", toMention: "b", fromBar: 32 }],
      confidence: 0.8,
    });
    assert.equal(hasTransitionProposals(transition), true);
  });
});
