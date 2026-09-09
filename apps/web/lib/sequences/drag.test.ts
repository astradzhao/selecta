import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  autoLinkTransitionId,
  dropFit,
  insertIndex,
  paletteTransitionQuery,
  paletteTransitionReason,
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
    assert.equal(insertIndex({ kind: "span", fromStepId: "s2", toStepId: "s3" }, steps), "append");
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

  it("in span mode only arms the fromStep gap when endpoints match the span pair", () => {
    const span = { fromIdx: 1, fromTrackId: "a", toTrackId: "c" };
    const ac = { fromTrackId: "a", toTrackId: "c" };
    const acBlock: FitPayload = {
      ...completeBlock,
      startTrackId: "a",
      endTrackId: "c",
    };
    assert.equal(
      dropFit({ kind: "transition", id: "ac" }, { kind: "gap", index: 1 }, steps, ac, span),
      true,
    );
    assert.equal(
      dropFit({ kind: "transition", id: "ab" }, { kind: "gap", index: 1 }, steps, ab, span),
      false,
    );
    assert.equal(
      dropFit({ kind: "transition", id: "ac" }, { kind: "gap", index: 2 }, steps, ac, span),
      false,
    );
    assert.equal(dropFit(acBlock, { kind: "gap", index: 1 }, steps, null, span), true);
    assert.equal(dropFit(acBlock, { kind: "step", index: 2 }, steps, null, span), false);
    assert.equal(dropFit(acBlock, { kind: "end", index: 3 }, steps, null, span), false);
    assert.equal(
      dropFit({ kind: "track", id: "x", title: "X" }, { kind: "gap", index: 1 }, steps, null, span),
      false,
    );
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
    assert.deepEqual(
      paletteTransitionQuery({ kind: "step", stepId: "inner" }, steps, [
        { id: "inner", trackId: "x" },
      ]),
      { fromTrackId: "x" },
    );
  });

  it("does not treat a first-step gap selection as a pair", () => {
    assert.deepEqual(paletteTransitionQuery({ kind: "gap", stepId: "s1" }, steps), {
      fromTrackId: "c",
    });
    assert.deepEqual(
      paletteTransitionQuery({ kind: "span", fromStepId: "s2", toStepId: "s3" }, steps),
      {
        fromTrackId: "a",
        toTrackId: "c",
      },
    );
  });
});

describe("paletteTransitionReason", () => {
  it("rejects a mix that does not rejoin the selected span", () => {
    const span = { kind: "span" as const, fromStepId: "s2", toStepId: "s3" };
    const ac: FitPayload = {
      kind: "transition",
      id: "ac",
      fromTrackId: "a",
      toTrackId: "c",
      fromTitle: "A",
      toTitle: "C",
      technique: "cut",
    };
    const abMix: FitPayload = {
      ...ac,
      id: "ab",
      toTrackId: "b",
      toTitle: "B",
    };
    assert.equal(paletteTransitionReason(ac, span, steps), null);
    assert.equal(paletteTransitionReason(abMix, span, steps), "Does not fit the selected span");
  });

  it("disables connector adds while wrapping a set span", () => {
    const span = { kind: "span" as const, fromStepId: "s1", toStepId: "s3" };
    const ac: FitPayload = {
      kind: "transition",
      id: "ac",
      fromTrackId: "a",
      toTrackId: "c",
      fromTitle: "A",
      toTitle: "C",
      technique: "cut",
    };
    assert.equal(
      paletteTransitionReason(ac, span, steps, [], true),
      "Make a block from the selected tracks, or clear the selection",
    );
  });
});
