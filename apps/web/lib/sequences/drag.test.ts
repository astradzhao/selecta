import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  autoLinkTransitionId,
  dropFit,
  insertIndex,
  paletteTransitionQuery,
  type FitPayload,
} from "./drag";
import type { DropTarget } from "./types";

const steps = [
  { id: "s1", trackId: "a" },
  { id: "s2", trackId: "b" },
  { id: "s3", trackId: "c" },
];

const ab = { fromTrackId: "a", toTrackId: "b" };

const completeBlock: FitPayload = {
  kind: "block",
  id: "blk-1",
  title: "Acid build",
  stepCount: 4,
  startTrackId: "a",
  endTrackId: "b",
  isComplete: true,
};

const incompleteBlock: FitPayload = {
  ...completeBlock,
  isComplete: false,
};

describe("insertIndex", () => {
  it("appends with no selection, inserts at a gap, and after a step", () => {
    assert.equal(insertIndex({ kind: "none" }, steps), "append");
    assert.equal(insertIndex({ kind: "gap", stepId: "s2" }, steps), 1);
    assert.equal(insertIndex({ kind: "step", stepId: "s2" }, steps), 2);
    assert.equal(insertIndex({ kind: "step", stepId: "s3" }, steps), 3);
    assert.equal(insertIndex({ kind: "step", stepId: "nested-child" }, steps), "append");
  });
});

describe("dropFit", () => {
  it("lets a track land on every target", () => {
    const payload = { kind: "track" as const, id: "x" };
    const targets: DropTarget[] = [
      { kind: "gap", index: 1 },
      { kind: "step", index: 2 },
      { kind: "end", index: 3 },
    ];
    for (const target of targets) {
      assert.equal(dropFit(payload, target, steps), true);
    }
  });

  it("requires both endpoints for a transition dropped on a gap", () => {
    assert.equal(
      dropFit({ kind: "transition", id: "ab" }, { kind: "gap", index: 1 }, steps, ab),
      true,
    );
    assert.equal(
      dropFit({ kind: "transition", id: "ab" }, { kind: "gap", index: 2 }, steps, ab),
      false,
    );
  });

  it("requires from === previous track when dropping a transition on a step or the end", () => {
    assert.equal(
      dropFit({ kind: "transition", id: "ab" }, { kind: "step", index: 1 }, steps, ab),
      true,
    );
    assert.equal(
      dropFit({ kind: "transition", id: "ab" }, { kind: "end", index: 3 }, steps, ab),
      false,
    );
    assert.equal(
      dropFit({ kind: "transition", id: "ab" }, { kind: "end", index: 0 }, [], ab),
      true,
    );
  });

  it("rejects incomplete blocks everywhere and matches both endpoints on a gap", () => {
    const targets: DropTarget[] = [
      { kind: "gap", index: 1 },
      { kind: "step", index: 2 },
      { kind: "end", index: 3 },
    ];
    for (const target of targets) {
      assert.equal(dropFit(incompleteBlock, target, steps), false);
    }
    assert.equal(dropFit(completeBlock, { kind: "gap", index: 1 }, steps), true);
    assert.equal(dropFit(completeBlock, { kind: "gap", index: 2 }, steps), false);
    assert.equal(dropFit(completeBlock, { kind: "step", index: 2 }, steps), true);
    assert.equal(dropFit(completeBlock, { kind: "end", index: 3 }, steps), true);
  });
});

describe("autoLinkTransitionId", () => {
  it("pins the only candidate and leaves 0 or 2+ unlinked", () => {
    assert.equal(autoLinkTransitionId([{ id: "only" }]), "only");
    assert.equal(autoLinkTransitionId([]), null);
    assert.equal(autoLinkTransitionId([{ id: "a" }, { id: "b" }]), null);
  });
});

describe("paletteTransitionQuery", () => {
  it("narrows to the selected pair, otherwise outbound from the insert anchor", () => {
    assert.deepEqual(paletteTransitionQuery({ kind: "gap", stepId: "s2" }, steps), {
      fromTrackId: "a",
      toTrackId: "b",
    });
    assert.deepEqual(paletteTransitionQuery({ kind: "none" }, steps), { fromTrackId: "c" });
    assert.deepEqual(paletteTransitionQuery({ kind: "step", stepId: "s1" }, steps), {
      fromTrackId: "a",
    });
    assert.deepEqual(paletteTransitionQuery({ kind: "none" }, []), {});
  });

  it("does not treat a first-step gap selection as a pair", () => {
    assert.deepEqual(paletteTransitionQuery({ kind: "gap", stepId: "s1" }, steps), {
      fromTrackId: "c",
    });
  });
});
