import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isMusicWriteError } from "./errors";
import { formatMixPoint, optionalHotCue, pioneerHotCueSlot } from "./mix-point";

describe("optionalHotCue", () => {
  it("uppercases Pioneer A–H and keeps Serato 1–8 and named cues", () => {
    assert.equal(optionalHotCue("a"), "A");
    assert.equal(optionalHotCue("H"), "H");
    assert.equal(optionalHotCue("3"), "3");
    assert.equal(optionalHotCue(" Drop "), "Drop");
    assert.equal(optionalHotCue(""), null);
    assert.equal(optionalHotCue("   "), null);
    assert.equal(optionalHotCue(null), null);
  });

  it("rejects labels longer than 16 characters", () => {
    try {
      optionalHotCue("this-cue-name-is-way-too-long");
      assert.fail("expected invalid_input");
    } catch (error) {
      assert.equal(isMusicWriteError(error), true);
      if (isMusicWriteError(error)) assert.equal(error.code, "invalid_input");
    }
  });
});

describe("pioneerHotCueSlot", () => {
  it("maps Pioneer A–H and Serato 1–8 onto the hardware bank", () => {
    assert.equal(pioneerHotCueSlot("a"), "A");
    assert.equal(pioneerHotCueSlot("H"), "H");
    assert.equal(pioneerHotCueSlot("1"), "A");
    assert.equal(pioneerHotCueSlot("8"), "H");
    assert.equal(pioneerHotCueSlot("3"), "C");
  });

  it("leaves named cues and empty values unmapped", () => {
    assert.equal(pioneerHotCueSlot("Drop"), null);
    assert.equal(pioneerHotCueSlot("9"), null);
    assert.equal(pioneerHotCueSlot("AB"), null);
    assert.equal(pioneerHotCueSlot(""), null);
    assert.equal(pioneerHotCueSlot(null), null);
  });
});

describe("formatMixPoint", () => {
  it("joins cue and bar, and omits empty halves", () => {
    assert.equal(formatMixPoint("A", 81), "A · 81");
    assert.equal(formatMixPoint("A", null), "A");
    assert.equal(formatMixPoint(null, 81), "81");
    assert.equal(formatMixPoint(null, null), null);
    assert.equal(formatMixPoint("  ", Number.NaN), null);
  });
});
