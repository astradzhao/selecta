import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listSequencesSearchParams, sequenceDetailSearchParams } from "./api";

describe("listSequencesSearchParams", () => {
  it("sends startTrack/endTrack, not startTrackId/endTrackId", () => {
    const qs = listSequencesSearchParams({
      kind: "block",
      startTrack: "from-1",
      endTrack: "to-2",
    });
    assert.equal(qs.includes("startTrack=from-1"), true);
    assert.equal(qs.includes("endTrack=to-2"), true);
    assert.equal(qs.includes("startTrackId"), false);
    assert.equal(qs.includes("endTrackId"), false);
  });
});

describe("sequenceDetailSearchParams", () => {
  it("sends expand=1 and version when asked", () => {
    assert.equal(sequenceDetailSearchParams({}), "");
    assert.equal(sequenceDetailSearchParams({ expand: true }), "expand=1");
    assert.equal(
      sequenceDetailSearchParams({ expand: true, versionId: "ver-1" }),
      "expand=1&version=ver-1",
    );
  });
});
