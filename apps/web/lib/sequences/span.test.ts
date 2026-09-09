import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderSpan } from "./alternates";
import {
  canWrapSpan,
  coveredStepIdsInRange,
  isExactLiveUnit,
  orderStepSpan,
  snapSpanToUnits,
  stepSpan,
} from "./span";

const steps = [
  { id: "s1", trackId: "a" },
  { id: "s2", trackId: "b" },
  { id: "s3", trackId: "c" },
];

const liveUnit = [
  { id: "a", inBlockId: null, gapState: null },
  { id: "b", inBlockId: "blk", gapState: "linked" },
  { id: "c", inBlockId: null, gapState: "linked" },
];

describe("canWrapSpan", () => {
  it("is a set-only job — blocks keep shift-click for alternates", () => {
    assert.equal(canWrapSpan("set"), true);
    assert.equal(canWrapSpan("block"), false);
  });
});

describe("orderStepSpan", () => {
  it("includes the first track, unlike alternate orderSpan", () => {
    assert.deepEqual(orderStepSpan(steps, "s1", "s3"), { fromStepId: "s1", toStepId: "s3" });
    assert.deepEqual(orderSpan(steps, "s1", "s3"), { fromStepId: "s2", toStepId: "s3" });
  });

  it("returns null when an id is missing", () => {
    assert.equal(orderStepSpan(steps, "s1", "missing"), null);
  });
});

describe("stepSpan", () => {
  it("allows an opener start and rejects a reversed pair", () => {
    assert.deepEqual(stepSpan(steps, "s1", "s2"), { fromIdx: 0, toIdx: 1 });
    assert.equal(stepSpan(steps, "s3", "s1"), null);
  });
});

describe("snapSpanToUnits", () => {
  it("expands a selection that starts on a unit host to include the anchor", () => {
    assert.deepEqual(snapSpanToUnits(liveUnit, 1, 2), { fromIdx: 0, toIdx: 2 });
    assert.deepEqual(snapSpanToUnits(liveUnit, 0, 0), { fromIdx: 0, toIdx: 1 });
  });
});

describe("isExactLiveUnit", () => {
  it("is true only for a two-step live unit", () => {
    assert.equal(isExactLiveUnit(liveUnit, 0, 1), true);
    assert.equal(isExactLiveUnit(liveUnit, 0, 2), false);
    assert.equal(isExactLiveUnit(liveUnit, 2, 2), false);
  });
});

describe("coveredStepIdsInRange", () => {
  it("includes the opener", () => {
    assert.deepEqual([...coveredStepIdsInRange(steps, "s1", "s2")], ["s1", "s2"]);
  });
});
