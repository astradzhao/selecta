import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { displayGapState } from "./gap-display";

describe("displayGapState", () => {
  it("treats available gaps with zero transition candidates as unmapped", () => {
    assert.equal(
      displayGapState({
        gapState: "available",
        inBlockId: null,
        inTransitionId: null,
        transitionCandidateCount: 0,
      }),
      "unmapped",
    );
  });

  it("keeps available when transition candidates exist", () => {
    assert.equal(
      displayGapState({
        gapState: "available",
        inBlockId: null,
        inTransitionId: null,
        transitionCandidateCount: 2,
      }),
      "available",
    );
  });

  it("renders a block pin without a valid transition as a muted placeholder", () => {
    assert.equal(
      displayGapState({
        gapState: "available",
        inBlockId: "blk-1",
        inTransitionId: null,
        transitionCandidateCount: 1,
      }),
      "block",
    );
  });
});
