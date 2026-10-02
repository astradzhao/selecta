import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bpmDelta,
  formatPlannedLine,
  mixLabel,
  plannedMetrics,
  sequenceRuntimeSec,
  sequenceTrackCount,
} from "./metrics";

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
      { gapState: null, track: { durationSec: 180, bpm: 120 }, inTransition: null },
      {
        gapState: "linked",
        track: { durationSec: 180, bpm: 124 },
        inTransition: { barsOverlap: 8 },
      },
    ]);
    assert.equal(total, 344);
  });

  it("uses the child runtime for a linked block unit instead of the two endpoints", () => {
    const total = sequenceRuntimeSec([
      { gapState: null, track: { durationSec: 180, bpm: 120 }, inTransition: null },
      {
        gapState: "linked",
        track: { durationSec: 180, bpm: 124 },
        inTransition: null,
        inBlock: { runtimeSec: 500 },
      },
      {
        gapState: "linked",
        track: { durationSec: 60, bpm: 120 },
        inTransition: { barsOverlap: null },
      },
    ]);
    assert.equal(total, 560);
  });
});

describe("sequenceTrackCount", () => {
  it("counts a linked block's interior once and the rest of the spine around it", () => {
    assert.equal(
      sequenceTrackCount([
        { gapState: null, inBlock: null },
        { gapState: "linked", inBlock: { stepCount: 4 } },
        { gapState: "linked", inBlock: null },
        { gapState: "unmapped", inBlock: null },
      ]),
      6,
    );
  });
});

describe("mixLabel", () => {
  it("leads with From, Into, Overlap, then type, and never quality", () => {
    assert.equal(
      mixLabel({ technique: "Loop", fromBar: 81, toBar: 1, barsOverlap: 16 }),
      "From 81 · Into 1 · Overlap 16 · Loop",
    );
  });

  it("joins hot cues with bars and can stand in for a missing bar", () => {
    assert.equal(
      mixLabel({
        technique: "Cut",
        fromBar: 81,
        toBar: null,
        fromCue: "A",
        toCue: "B",
        barsOverlap: null,
      }),
      "From A · 81 · Into B · Cut",
    );
  });

  it("omits empty slots and falls back to mix when nothing is known", () => {
    assert.equal(
      mixLabel({ technique: "Cut", fromBar: null, toBar: null, barsOverlap: 4 }),
      "Overlap 4 · Cut",
    );
    assert.equal(
      mixLabel({ technique: null, fromBar: 24, toBar: 32, barsOverlap: null }),
      "From 24 · Into 32",
    );
    assert.equal(
      mixLabel({ technique: null, fromBar: null, toBar: null, barsOverlap: null }),
      "mix",
    );
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
