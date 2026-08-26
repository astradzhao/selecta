import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { moveUnit, reorderTo, unitRange } from "./reorder";

describe("unitRange", () => {
  it("returns a single-step unit for every index in SET-4", () => {
    const steps = ["a", "b", "c"];
    assert.deepEqual(unitRange(steps, 0), [0, 0]);
    assert.deepEqual(unitRange(steps, 1), [1, 1]);
    assert.deepEqual(unitRange(steps, 2), [2, 2]);
  });
});

describe("moveUnit", () => {
  it("is a no-op at the first and last index", () => {
    const steps = ["a", "b", "c"];
    assert.deepEqual(moveUnit(steps, 0, -1), ["a", "b", "c"]);
    assert.deepEqual(moveUnit(steps, 2, 1), ["a", "b", "c"]);
  });

  it("swaps a middle step with its neighbor", () => {
    assert.deepEqual(moveUnit(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
    assert.deepEqual(moveUnit(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
  });
});

describe("reorderTo", () => {
  it("swaps with the next card when dropped on it", () => {
    assert.deepEqual(reorderTo(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
    assert.deepEqual(reorderTo(["a", "b", "c"], 2, 1), ["a", "c", "b"]);
  });

  it("lands on the drop target when moving more than one slot", () => {
    assert.deepEqual(reorderTo(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
    assert.deepEqual(reorderTo(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  });

  it("ignores a drop onto the same unit", () => {
    assert.deepEqual(reorderTo(["a", "b", "c"], 1, 1), ["a", "b", "c"]);
  });
});
