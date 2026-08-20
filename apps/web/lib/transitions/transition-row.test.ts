import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPTY_SHIFT, formatBpmShift, formatKeyShift } from "./transition-row";

describe("transition shift formatting", () => {
  it("keeps both slots visible, rounding bpm and dashing anything unset", () => {
    assert.equal(formatBpmShift(128.4, 150), "128 → 150");
    assert.equal(formatBpmShift(128, null), "128 → -");
    assert.equal(formatBpmShift(null, null), EMPTY_SHIFT);
    assert.equal(formatKeyShift("8A", "5A"), "8A → 5A");
    assert.equal(formatKeyShift("  ", "5A"), "- → 5A");
    assert.equal(formatKeyShift(null, null), EMPTY_SHIFT);
  });
});
