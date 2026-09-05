import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { graphTrailToSequenceSeed, parseGraphSessionState } from "./session-store";

const FREEFORM_EMPTY = {
  activeId: null,
  trail: [],
  sequenceId: null,
  versionId: null,
  stepId: null,
  alternateId: null,
};

describe("parseGraphSessionState", () => {
  it("rehydrates a v2 trail of hops with transition ids", () => {
    const raw = JSON.stringify({
      activeId: "c",
      trail: [
        { trackId: "a", inTransitionId: "t-ab" },
        { trackId: "b", inTransitionId: "t-bc" },
      ],
    });
    assert.deepEqual(parseGraphSessionState(raw), {
      activeId: "c",
      trail: [
        { trackId: "a", inTransitionId: "t-ab", fromStepId: null, fromAlternateId: null },
        { trackId: "b", inTransitionId: "t-bc", fromStepId: null, fromAlternateId: null },
      ],
      sequenceId: null,
      versionId: null,
      stepId: null,
      alternateId: null,
    });
  });

  it("rehydrates set-mode cursor fields on a v2 payload", () => {
    const raw = JSON.stringify({
      activeId: "b",
      sequenceId: "seq-1",
      versionId: "ver-1",
      stepId: "s2",
      alternateId: null,
      trail: [{ trackId: "a", inTransitionId: "t-ab", fromStepId: "s1", fromAlternateId: null }],
    });
    assert.deepEqual(parseGraphSessionState(raw), {
      activeId: "b",
      sequenceId: "seq-1",
      versionId: "ver-1",
      stepId: "s2",
      alternateId: null,
      trail: [{ trackId: "a", inTransitionId: "t-ab", fromStepId: "s1", fromAlternateId: null }],
    });
  });

  it("drops a v1 payload of track ids", () => {
    const raw = JSON.stringify({
      activeId: "c",
      trail: ["a", "b"],
    });
    assert.deepEqual(parseGraphSessionState(raw), FREEFORM_EMPTY);
  });
});

describe("graphTrailToSequenceSeed", () => {
  it("moves each hop's outbound edge onto the next step", () => {
    assert.deepEqual(
      graphTrailToSequenceSeed(
        [
          { trackId: "a", inTransitionId: "t-ab" },
          { trackId: "b", inTransitionId: "t-bc" },
        ],
        "c",
      ),
      [
        { trackId: "a", inTransitionId: null },
        { trackId: "b", inTransitionId: "t-ab" },
        { trackId: "c", inTransitionId: "t-bc" },
      ],
    );
  });
});
