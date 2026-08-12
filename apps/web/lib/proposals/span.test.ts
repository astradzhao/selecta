import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { locateSpan } from "./span";

describe("locateSpan", () => {
  it("uses exact offsets when slice matches after whitespace normalization", () => {
    const rawText = "mix  A  into B";
    const result = locateSpan(rawText, 5, 8, "A");
    assert.equal(result.mode, "exact");
    assert.equal(result.start, 5);
    assert.equal(result.end, 8);
  });

  it("falls back to indexOf when offsets drift", () => {
    const rawText = "mix A into B";
    const result = locateSpan(rawText, 99, 100, "A into");
    assert.equal(result.mode, "search");
    assert.equal(rawText.slice(result.start, result.end), "A into");
  });

  it("returns standalone when source text is missing", () => {
    const result = locateSpan("mix A into B", 0, 1, "missing span");
    assert.equal(result.mode, "standalone");
    assert.equal(result.start, 0);
    assert.equal(result.end, 0);
  });
});
