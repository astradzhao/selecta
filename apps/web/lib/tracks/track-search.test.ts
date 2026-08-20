import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { excludeTracksById, librarySearchParams, shouldRunTrackSearch } from "./track-search";

describe("shouldRunTrackSearch", () => {
  it("does not search catalog-style queries under the minimum length", () => {
    assert.equal(shouldRunTrackSearch("a", { minQueryLength: 2, searchWhenEmpty: false }), false);
    assert.equal(shouldRunTrackSearch("ab", { minQueryLength: 2, searchWhenEmpty: false }), true);
  });

  it("can search an empty query when the picker should populate immediately", () => {
    assert.equal(shouldRunTrackSearch("", { minQueryLength: 1, searchWhenEmpty: true }), true);
    assert.equal(shouldRunTrackSearch("   ", { minQueryLength: 1, searchWhenEmpty: false }), false);
  });
});

describe("librarySearchParams", () => {
  it("omits a blank query so the API returns the unfiltered page", () => {
    assert.deepEqual(librarySearchParams("  ", 40), { query: undefined, limit: 40 });
    assert.deepEqual(librarySearchParams("cut", 8), { query: "cut", limit: 8 });
  });
});

describe("excludeTracksById", () => {
  it("drops excluded library ids so a track cannot be picked twice", () => {
    const tracks = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(excludeTracksById(tracks, ["b"]), [{ id: "a" }, { id: "c" }]);
  });
});
