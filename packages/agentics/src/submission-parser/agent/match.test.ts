import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mentionSearchQuery, stripCueSuffixesFromSearchQuery, topSearchHit } from "./match";
import type { NoteMentionPlan } from "./schema";
import type { TrackCandidate } from "./services";

function mention(
  partial: Partial<NoteMentionPlan> & Pick<NoteMentionPlan, "mention">,
): NoteMentionPlan {
  return {
    mentionId: "m1",
    titleHint: null,
    artistHint: null,
    selectedCandidateId: null,
    resolutionStatus: "unresolved",
    confidence: null,
    ambiguityReason: null,
    ...partial,
  };
}

describe("mention search helpers", () => {
  it("uses mention text as the search query", () => {
    assert.equal(
      mentionSearchQuery(mention({ mention: "backspin bass", titleHint: "ignored" })),
      "backspin bass",
    );
  });

  it("falls back to title+artist when mention is empty", () => {
    assert.equal(
      mentionSearchQuery(mention({ mention: " ", titleHint: "Thrilla", artistHint: "nightmre" })),
      "Thrilla nightmre",
    );
  });

  it("strips bar cue suffixes from mention search queries", () => {
    assert.equal(
      mentionSearchQuery(mention({ mention: "Echo - chainsmokers at bar 33" })),
      "Echo - chainsmokers",
    );
    assert.equal(
      mentionSearchQuery(mention({ mention: "sweet nothing - calvin harris at bar 18" })),
      "sweet nothing - calvin harris",
    );
    assert.equal(stripCueSuffixesFromSearchQuery("levels avicii bar 64"), "levels avicii");
    assert.equal(stripCueSuffixesFromSearchQuery("titanium bars 32-48"), "titanium");
  });

  it("takes the first search hit", () => {
    const first: TrackCandidate = {
      handle: "spotify:first",
      title: "Backspin Bass",
      artists: ["Tape B"],
      providerId: "first",
    };
    const second: TrackCandidate = {
      handle: "spotify:second",
      title: "Backspin",
      artists: ["MEMODEMO"],
      providerId: "second",
    };
    assert.equal(topSearchHit([first, second])?.handle, "spotify:first");
    assert.equal(topSearchHit([]), null);
  });
});
