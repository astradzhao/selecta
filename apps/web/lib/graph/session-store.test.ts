import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { graphTrailToSequenceSeed, parseGraphSessionState } from "./session-store";

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
        { trackId: "a", inTransitionId: "t-ab" },
        { trackId: "b", inTransitionId: "t-bc" },
      ],
    });
  });

  it("drops a v1 payload of track ids", () => {
    const raw = JSON.stringify({
      activeId: "c",
      trail: ["a", "b"],
    });
    assert.deepEqual(parseGraphSessionState(raw), { activeId: null, trail: [] });
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
