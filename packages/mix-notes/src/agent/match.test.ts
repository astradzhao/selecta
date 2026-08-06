import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mentionSearchQuery, topSearchHit } from "./match";
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
