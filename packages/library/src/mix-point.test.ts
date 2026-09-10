import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isMusicWriteError } from "./errors";
import { formatMixPoint, optionalHotCue } from "./mix-point";

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

describe("formatMixPoint", () => {
  it("joins cue and bar, and omits empty halves", () => {
    assert.equal(formatMixPoint("A", 81), "A · 81");
    assert.equal(formatMixPoint("A", null), "A");
    assert.equal(formatMixPoint(null, 81), "81");
    assert.equal(formatMixPoint(null, null), null);
    assert.equal(formatMixPoint("  ", Number.NaN), null);
  });
});
