import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampListLimit,
  clampListOffset,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
} from "./list-page";

describe("list page helpers", () => {
  it("clamps limit into the Library page bounds", () => {
    assert.equal(clampListLimit(undefined), DEFAULT_LIST_LIMIT);
    assert.equal(clampListLimit(0), 1);
    assert.equal(clampListLimit(999), MAX_LIST_LIMIT);
    assert.equal(clampListLimit(12.9), 12);
  });

  it("clamps offset to a non-negative integer", () => {
    assert.equal(clampListOffset(undefined), 0);
    assert.equal(clampListOffset(-4), 0);
    assert.equal(clampListOffset(3.7), 3);
  });
});
