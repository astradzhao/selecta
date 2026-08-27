import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sequenceRuntimeSec, sequenceTrackCount } from "./sequence-runtime";

function track(durationSec: number, bpm: number | null = 120) {
  return { durationSec, bpm };
}

describe("sequenceRuntimeSec", () => {
  it("subtracts overlap in seconds using the from-track BPM", () => {
    const total = sequenceRuntimeSec([
      { gapState: null, track: track(180, 120), inTransition: null },
      { gapState: "linked", track: track(180, 124), inTransition: { barsOverlap: 8 } },
    ]);
    assert.equal(total, 344);
  });

  it("uses the child runtime for a linked block unit instead of the two endpoints", () => {
    const total = sequenceRuntimeSec([
      { gapState: null, track: track(180, 120), inTransition: null },
      {
        gapState: "linked",
        track: track(180, 124),
        inTransition: null,
        inBlock: { runtimeSec: 500 },
      },
      { gapState: "linked", track: track(60, 120), inTransition: { barsOverlap: null } },
    ]);
    assert.equal(total, 560);
  });
});

describe("sequenceTrackCount", () => {
  it("counts a linked block's interior once and the rest of the spine around it", () => {
    const steps = [
      { gapState: null, inBlock: null },
      { gapState: "linked", inBlock: { stepCount: 4 } },
      { gapState: "linked", inBlock: null },
      { gapState: "unmapped", inBlock: null },
    ];
    assert.equal(sequenceTrackCount(steps), 6);
  });
});
