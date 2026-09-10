import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canInspectMix, displayGapState, gapRowLabel } from "./gap-display";

const emptyBlock = {
  id: "blk-1",
  title: "Acid build",
  stepCount: 4,
  seamCount: 0,
  isComplete: true,
  runtimeSec: 400,
  versions: [],
};

describe("displayGapState", () => {
  it("keeps available when only block candidates exist", () => {
    assert.equal(
      displayGapState({
        gapState: "available",
        inBlockId: null,
        inBlock: null,
      }),
      "available",
    );
  });

  it("keeps available when transition candidates exist", () => {
    assert.equal(
      displayGapState({
        gapState: "available",
        inBlockId: null,
        inBlock: null,
      }),
      "available",
    );
  });

  it("treats a linked block connector as block, not an empty transition row", () => {
    assert.equal(
      displayGapState({
        gapState: "linked",
        inBlockId: "blk-1",
        inBlock: emptyBlock,
      }),
      "block",
    );
  });

  it("marks an unfinished child as block-incomplete", () => {
    assert.equal(
      displayGapState({
        gapState: "linked",
        inBlockId: "blk-1",
        inBlock: { ...emptyBlock, isComplete: false },
      }),
      "block-incomplete",
    );
  });

  it("marks a drifted pin as block-broken", () => {
    assert.equal(
      displayGapState({
        gapState: "available",
        inBlockId: "blk-1",
        inBlock: emptyBlock,
      }),
      "block-broken",
    );
  });
});

describe("canInspectMix", () => {
  const mix = {
    id: "tr-1",
    fromTrackId: "a",
    toTrackId: "b",
    fromBar: 16,
    toBar: 1,
    barsOverlap: 8,
    technique: "cut",
    intent: null,
    quality: "great",
    notes: "wait for the vocal",
  };

  it("is true only for a linked transition pin", () => {
    assert.equal(canInspectMix("linked", mix), true);
    assert.equal(canInspectMix("linked", null), false);
    assert.equal(canInspectMix("available", mix), false);
    assert.equal(canInspectMix("unmapped", mix), false);
    assert.equal(canInspectMix("seam", mix), false);
    assert.equal(canInspectMix("block", mix), false);
    assert.equal(canInspectMix("block-incomplete", mix), false);
    assert.equal(canInspectMix("block-broken", mix), false);
    assert.equal(canInspectMix(null, mix), false);
  });
});

describe("gapRowLabel", () => {
  it("names a linked mix with in/out bars, overlap, and technique — not quality", () => {
    assert.equal(
      gapRowLabel(
        "linked",
        {
          inTransition: {
            id: "tr-1",
            fromTrackId: "a",
            toTrackId: "b",
            fromBar: 48,
            toBar: 1,
            barsOverlap: 8,
            technique: "blend",
            intent: null,
            quality: "great",
            notes: null,
          },
          inBlock: null,
          transitionCandidateCount: 1,
          candidateCount: 1,
        },
        "From",
        "To",
      ),
      "out 48 · overlap 8 · in 1 · Blend",
    );
  });
});
