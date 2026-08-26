import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bpmDelta, formatPlannedLine, plannedMetrics, sequenceRuntimeSec } from "./metrics";

describe("plannedMetrics", () => {
  it("excludes seams from the planned denominator", () => {
    const metrics = plannedMetrics([
      { gapState: null },
      { gapState: "linked" },
      { gapState: "unmapped" },
      { gapState: "seam" },
    ]);
    assert.deepEqual(metrics, { linked: 1, planned: 2, seams: 1 });
    assert.equal(formatPlannedLine(metrics, 4), "1 of 2 planned");
  });

  it("reports nothing planned when the sequence is empty", () => {
    assert.equal(formatPlannedLine({ linked: 0, planned: 0, seams: 0 }, 0), "nothing planned yet");
  });
});

describe("sequenceRuntimeSec", () => {
  it("subtracts overlap in seconds using the from-track BPM", () => {
    const total = sequenceRuntimeSec([
      {
        gapState: null,
        track: {
          id: "a",
          title: "A",
          artists: [],
          artworkUrl: null,
          bpm: 120,
          musicalKey: null,
          durationSec: 180,
        },
        inTransition: null,
      },
      {
        gapState: "linked",
        track: {
          id: "b",
          title: "B",
          artists: [],
          artworkUrl: null,
          bpm: 124,
          musicalKey: null,
          durationSec: 180,
        },
        inTransition: { barsOverlap: 8 },
      },
    ]);
    assert.equal(total, 344);
  });
});

describe("bpmDelta", () => {
  it("returns a signed chip and skips missing BPM", () => {
    assert.equal(bpmDelta(124, 122), "−2");
    assert.equal(bpmDelta(120, 122), "+2");
    assert.equal(bpmDelta(120, 120), "0");
    assert.equal(bpmDelta(null, 122), null);
    assert.equal(bpmDelta(124, null), null);
  });
});
