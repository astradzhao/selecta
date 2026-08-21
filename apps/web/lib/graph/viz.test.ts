import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { barStripTickCount, clampConfidence, qualityFill, qualityBadgeTone } from "./viz";

describe("barStripTickCount", () => {
  it("returns null when no bar data is set so the strip can hide", () => {
    assert.equal(barStripTickCount(null, null, null), null);
  });

  it("pads to a multiple of 4 between 8 and 32 ticks", () => {
    assert.equal(barStripTickCount(1, null, null), 16);
    assert.equal(barStripTickCount(17, 20, 2), 20);
    assert.equal(barStripTickCount(100, null, null), 32);
  });
});

describe("qualityFill", () => {
  it("maps ranked qualities and leaves unrated empty", () => {
    assert.equal(qualityFill("great"), 1);
    assert.equal(qualityFill("ok"), 0.55);
    assert.equal(qualityFill("risky"), 0.25);
    assert.equal(qualityFill(null), null);
  });
});

describe("qualityBadgeTone", () => {
  it("uses the brand wash for great so a quality chip is not a solid CTA", () => {
    assert.equal(qualityBadgeTone("great"), "brand");
    assert.equal(qualityBadgeTone("ok"), "tertiary");
    assert.equal(qualityBadgeTone("risky"), "outline");
  });
});

describe("clampConfidence", () => {
  it("clamps finite confidence into 0–1", () => {
    assert.equal(clampConfidence(0), 0);
    assert.equal(clampConfidence(1.4), 1);
    assert.equal(clampConfidence(Number.NaN), null);
  });
});
