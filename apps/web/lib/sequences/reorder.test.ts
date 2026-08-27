import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { moveUnit, reorderTo, unitDisplayIndex, unitRange } from "./reorder";

const blockUnit = [
  { id: "t1", inBlockId: null, gapState: null },
  { id: "t2", inBlockId: "blk", gapState: "linked" as const },
  { id: "t3", inBlockId: null, gapState: "linked" as const },
];

describe("unitRange", () => {
  it("returns a single-step unit when no block connector is live", () => {
    const steps = ["a", "b", "c"];
    assert.deepEqual(unitRange(steps, 0), [0, 0]);
    assert.deepEqual(unitRange(steps, 1), [1, 1]);
    assert.deepEqual(unitRange(steps, 2), [2, 2]);
  });

  it("treats a live block host and its anchor as one unit", () => {
    assert.deepEqual(unitRange(blockUnit, 1), [0, 1]);
    assert.deepEqual(unitRange(blockUnit, 0), [0, 1]);
    assert.deepEqual(unitRange(blockUnit, 2), [2, 2]);
  });

  it("treats a broken pin as a single step", () => {
    const steps = [
      { id: "t1", inBlockId: null, gapState: null },
      { id: "t2", inBlockId: "blk", gapState: "available" as const },
      { id: "t3", inBlockId: null, gapState: "linked" as const },
    ];
    assert.deepEqual(unitRange(steps, 1), [1, 1]);
    assert.deepEqual(unitRange(steps, 0), [0, 0]);
  });
});

describe("unitDisplayIndex", () => {
  it("numbers a live block unit once", () => {
    assert.equal(unitDisplayIndex(blockUnit, 0), 0);
    assert.equal(unitDisplayIndex(blockUnit, 1), 0);
    assert.equal(unitDisplayIndex(blockUnit, 2), 1);
  });

  it("keeps one number per spine step when nothing is a unit", () => {
    const steps = ["a", "b", "c"];
    assert.equal(unitDisplayIndex(steps, 0), 0);
    assert.equal(unitDisplayIndex(steps, 1), 1);
    assert.equal(unitDisplayIndex(steps, 2), 2);
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

  it("is a no-op when moving the host of a unit at the start of the line up", () => {
    assert.deepEqual(moveUnit(blockUnit, 1, -1), blockUnit);
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
