import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreTitleArtist, uniqueBestCandidate } from "./match";
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

describe("uniqueBestCandidate", () => {
  it("prefers the first search hit when top scores tie", () => {
    const m = mention({
      mention: "Saturday Love - Matroda",
      titleHint: "Saturday Love",
      artistHint: "Matroda",
    });
    const first: TrackCandidate = {
      handle: "spotify:first",
      title: "Saturday Love",
      artists: ["Matroda", "Dino DZ"],
      providerId: "first",
    };
    const second: TrackCandidate = {
      handle: "spotify:second",
      title: "Saturday Love",
      artists: ["Matroda", "Dino DZ", "Insomniac Records"],
      providerId: "second",
    };
    assert.equal(scoreTitleArtist(m, first), 1);
    assert.equal(scoreTitleArtist(m, second), 1);
    assert.equal(uniqueBestCandidate(m, [first, second])?.handle, "spotify:first");
  });

  it("rejects close but unequal scores inside the margin", () => {
    const m = mention({
      mention: "Love Someone",
      titleHint: "Love Someone",
      artistHint: "Prospa",
    });
    const a: TrackCandidate = {
      handle: "spotify:a",
      title: "Love Someone (Edit)",
      artists: ["Prospa"],
      providerId: "a",
    };
    const b: TrackCandidate = {
      handle: "spotify:b",
      title: "Love Someone",
      artists: ["Prospa Band"],
      providerId: "b",
    };
    assert.equal(uniqueBestCandidate(m, [a, b]), null);
  });
});
