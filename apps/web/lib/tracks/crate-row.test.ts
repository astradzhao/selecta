import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatBpmKey } from "./crate-row";

describe("formatBpmKey", () => {
  it("joins bpm and key, and drops empty slots so the dash is a render concern", () => {
    assert.equal(formatBpmKey(128.4, "8A"), "128 · 8A");
    assert.equal(formatBpmKey(150, "  "), "150");
    assert.equal(formatBpmKey(null, "Fm"), "Fm");
    assert.equal(formatBpmKey(null, null), null);
  });
});
