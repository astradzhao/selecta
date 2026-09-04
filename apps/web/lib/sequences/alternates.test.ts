import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alternateCoverage,
  alternateVisual,
  alternatesForGap,
  canAuthorAlternates,
  canExpandAlternate,
  formatAlternateCoverage,
  orderSpan,
  spanRange,
  versionCountUsingAlternate,
} from "./alternates";
import type { SequenceAlternate } from "./types";

const steps = [
  { id: "s1", trackId: "a" },
  { id: "s2", trackId: "b" },
  { id: "s3", trackId: "c" },
];

function stubAlternate(
  partial: Pick<SequenceAlternate, "id" | "fromStepId" | "toStepId" | "valid">,
): SequenceAlternate {
  return {
    label: "if the room is hot",
    altTransitionId: "tr-1",
    altBlockId: null,
    altTransition: null,
    altBlock: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("canAuthorAlternates", () => {
  it("is a block-only job — nights do not grow their own tree", () => {
    assert.equal(canAuthorAlternates("block"), true);
    assert.equal(canAuthorAlternates("set"), false);
  });
});

describe("spanRange", () => {
  it("returns predecessor and destination for a forward span", () => {
    const range = spanRange(steps, "s2", "s3");
    assert.deepEqual(
      range && {
        fromIdx: range.fromIdx,
        toIdx: range.toIdx,
        predecessor: range.predecessor.id,
        destination: range.destination.id,
      },
      { fromIdx: 1, toIdx: 2, predecessor: "s1", destination: "s3" },
    );
  });

  it("rejects a missing id, a reversed span, and a first-step start", () => {
    assert.equal(spanRange(steps, "missing", "s2"), null);
    assert.equal(spanRange(steps, "s3", "s2"), null);
    assert.equal(spanRange(steps, "s1", "s2"), null);
  });
});

describe("orderSpan", () => {
  it("orders shift-click ids and clamps off the first track", () => {
    assert.deepEqual(orderSpan(steps, "s3", "s2"), { fromStepId: "s2", toStepId: "s3" });
    assert.deepEqual(orderSpan(steps, "s1", "s3"), { fromStepId: "s2", toStepId: "s3" });
  });

  it("returns null when the range is only the first track", () => {
    assert.equal(orderSpan(steps, "s1", "s1"), null);
  });
});

describe("alternatesForGap", () => {
  it("returns only alternates whose fromStep is this gap", () => {
    const items = [
      stubAlternate({ id: "a1", fromStepId: "s2", toStepId: "s2", valid: true }),
      stubAlternate({ id: "a2", fromStepId: "s2", toStepId: "s3", valid: true }),
      stubAlternate({ id: "a3", fromStepId: "s3", toStepId: "s3", valid: true }),
    ];
    assert.deepEqual(
      alternatesForGap(items, "s2").map((item) => item.id),
      ["a1", "a2"],
    );
  });
});

describe("alternateCoverage", () => {
  it("counts valid rows as mapped and ignores an empty list", () => {
    assert.deepEqual(alternateCoverage([{ valid: true }, { valid: true }, { valid: false }]), {
      total: 3,
      mapped: 2,
    });
    assert.equal(formatAlternateCoverage({ total: 0, mapped: 0 }), null);
    assert.equal(formatAlternateCoverage({ total: 3, mapped: 2 }), "3 alternates · 2 mapped");
  });
});

describe("alternateVisual", () => {
  it("keeps incomplete child blocks mapped and marks stale spans broken", () => {
    assert.equal(
      alternateVisual(
        stubAlternate({
          id: "ok",
          fromStepId: "s2",
          toStepId: "s2",
          valid: true,
        }),
      ),
      "mapped",
    );
    assert.equal(
      alternateVisual({
        ...stubAlternate({
          id: "open",
          fromStepId: "s2",
          toStepId: "s3",
          valid: true,
        }),
        altTransitionId: null,
        altBlockId: "blk",
        altBlock: {
          id: "blk",
          title: "Detour",
          stepCount: 3,
          seamCount: 0,
          isComplete: false,
          runtimeSec: 0,
        },
      }),
      "incomplete",
    );
    assert.equal(
      alternateVisual(
        stubAlternate({
          id: "stale",
          fromStepId: "s3",
          toStepId: "s2",
          valid: false,
        }),
      ),
      "broken",
    );
  });
});

describe("canExpandAlternate", () => {
  it("expands blocks and multi-step spans, not a one-step mix", () => {
    assert.equal(
      canExpandAlternate(
        stubAlternate({ id: "mix", fromStepId: "s2", toStepId: "s2", valid: true }),
      ),
      false,
    );
    assert.equal(
      canExpandAlternate(
        stubAlternate({ id: "span", fromStepId: "s2", toStepId: "s3", valid: true }),
      ),
      true,
    );
    assert.equal(
      canExpandAlternate({
        ...stubAlternate({ id: "blk", fromStepId: "s2", toStepId: "s2", valid: true }),
        altBlockId: "blk",
      }),
      true,
    );
    assert.equal(
      canExpandAlternate(
        stubAlternate({ id: "dead", fromStepId: "s2", toStepId: "s3", valid: false }),
      ),
      false,
    );
  });
});

describe("versionCountUsingAlternate", () => {
  it("counts saved versions that still point at the alternate", () => {
    assert.equal(
      versionCountUsingAlternate(
        [{ alternateIds: ["a1"] }, { alternateIds: ["a2", "a1"] }, { alternateIds: [] }],
        "a1",
      ),
      2,
    );
  });
});
