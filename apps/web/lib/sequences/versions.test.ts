import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SequenceAlternate, SequenceStep } from "./types";
import {
  BASE_VERSION_VALUE,
  canManageVersions,
  chosenIdsForVersion,
  formatVersionChip,
  idsConflictingWithSelection,
  resolveVersionPath,
  showVersionSwitcher,
} from "./versions";

function step(partial: Pick<SequenceStep, "id" | "trackId"> & Partial<SequenceStep>): SequenceStep {
  return {
    position: 0,
    inTransitionId: null,
    inBlockId: null,
    inBlockVersionId: null,
    isSeam: false,
    note: null,
    gapState: null,
    candidateCount: 0,
    transitionCandidateCount: 0,
    track: {
      id: partial.trackId,
      title: partial.trackId,
      artists: [],
      artworkUrl: null,
      bpm: null,
      musicalKey: null,
      durationSec: null,
    },
    inTransition: null,
    inBlock: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

function alt(
  partial: Pick<SequenceAlternate, "id" | "fromStepId" | "toStepId"> & Partial<SequenceAlternate>,
): SequenceAlternate {
  return {
    label: "if the room is hot",
    altTransitionId: "tr-1",
    altBlockId: null,
    valid: true,
    altTransition: {
      id: "tr-1",
      fromTrackId: "a",
      toTrackId: "c",
      fromBar: null,
      toBar: null,
      barsOverlap: null,
      technique: "cut",
      intent: null,
      quality: null,
      notes: null,
    },
    altBlock: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const steps = [
  step({ id: "s1", trackId: "a", position: 0 }),
  step({
    id: "s2",
    trackId: "b",
    position: 1,
    inTransitionId: "ab",
    gapState: "linked",
    inTransition: {
      id: "ab",
      fromTrackId: "a",
      toTrackId: "b",
      fromBar: null,
      toBar: null,
      barsOverlap: 8,
      technique: "blend",
      intent: null,
      quality: "ok",
      notes: null,
    },
  }),
  step({
    id: "s3",
    trackId: "c",
    position: 2,
    inTransitionId: "bc",
    gapState: "linked",
    inTransition: {
      id: "bc",
      fromTrackId: "b",
      toTrackId: "c",
      fromBar: null,
      toBar: null,
      barsOverlap: null,
      technique: "blend",
      intent: null,
      quality: null,
      notes: null,
    },
  }),
];

describe("canManageVersions", () => {
  it("is a block-only job", () => {
    assert.equal(canManageVersions("block"), true);
    assert.equal(canManageVersions("set"), false);
    assert.equal(showVersionSwitcher("block", 0, 1), true);
    assert.equal(showVersionSwitcher("block", 0, 0), false);
    assert.equal(showVersionSwitcher("set", 2, 2), false);
    assert.equal(BASE_VERSION_VALUE, "base");
  });
});

describe("resolveVersionPath", () => {
  it("is identity when no choices are on", () => {
    const resolved = resolveVersionPath(steps, [], []);
    assert.deepEqual(
      resolved.steps.map((item) => item.id),
      ["s1", "s2", "s3"],
    );
    assert.deepEqual(resolved.chips, {});
  });

  it("splices a two-step span and chips the rejoin", () => {
    const skip = alt({ id: "skip", fromStepId: "s2", toStepId: "s3" });
    const resolved = resolveVersionPath(steps, [skip], [skip.id]);
    assert.deepEqual(
      resolved.steps.map((item) => item.trackId),
      ["a", "c"],
    );
    assert.equal(resolved.steps[1]?.inTransitionId, "tr-1");
    assert.equal(resolved.chips.s3, "alternate · if the room is hot");
    assert.equal(formatVersionChip(null), "alternate");
  });
});

describe("idsConflictingWithSelection", () => {
  it("marks a covering span as conflicting with a one-step choice", () => {
    const one = alt({ id: "one", fromStepId: "s2", toStepId: "s2" });
    const two = alt({ id: "two", fromStepId: "s2", toStepId: "s3" });
    const conflicts = idsConflictingWithSelection(steps, [one, two], new Set(["one"]));
    assert.equal(conflicts.has("two"), true);
    assert.equal(conflicts.has("one"), false);
  });
});

describe("chosenIdsForVersion", () => {
  it("returns empty for Base", () => {
    assert.deepEqual(chosenIdsForVersion([{ id: "v1", alternateIds: ["a"] }], null), []);
    assert.deepEqual(chosenIdsForVersion([{ id: "v1", alternateIds: ["a"] }], "v1"), ["a"]);
  });
});
