import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import type { ApiTrack } from "./tracks/types";

import {
  fetchLibraryListIfStale,
  invalidateLibraryCache,
  libraryFingerprint,
  sameTrackList,
  writeLibraryCache,
} from "./library-cache";

afterEach(() => {
  invalidateLibraryCache();
});

function track(id: string, updatedAt: string): ApiTrack {
  return {
    id,
    title: id,
    artists: [],
    genres: [],
    subgenres: [],
    folders: [],
    artworkUrl: null,
    durationSec: null,
    releaseDate: null,
    bpm: null,
    musicalKey: null,
    energy: null,
    externalIds: {},
    libraryId: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

const FILTERS = { query: "", subgenre: "", folder: "" };

describe("sameTrackList", () => {
  it("treats identical id/updatedAt sequences as the same list", () => {
    const a = [track("a", "1"), track("b", "2")];
    const b = [track("a", "1"), track("b", "2")];
    assert.equal(sameTrackList(a, b), true);
    assert.equal(sameTrackList(a, [track("a", "1"), track("b", "3")]), false);
  });
});

describe("fetchLibraryListIfStale", () => {
  it("does not refetch tracks when the stats fingerprint still matches", async () => {
    const cached = [track("a", "1")];
    const stats = { count: 1, latestUpdatedAt: "2026-01-01T00:00:00.000Z" };
    writeLibraryCache("||", cached, libraryFingerprint(stats));

    const listTracks = mock.fn(async () => ({ tracks: [track("b", "2")] }));
    const result = await fetchLibraryListIfStale(FILTERS, {
      getLibraryStats: async () => stats,
      listTracks,
    });

    assert.equal(listTracks.mock.callCount(), 0);
    assert.equal(result.skipReplace, true);
    assert.equal(result.items, cached);
  });

  it("refetches and replaces when the fingerprint is stale", async () => {
    const cached = [track("a", "1")];
    writeLibraryCache("||", cached, libraryFingerprint({ count: 1, latestUpdatedAt: "old" }));
    const fresh = [track("a", "2")];

    const listTracks = mock.fn(async () => ({ tracks: fresh }));
    const result = await fetchLibraryListIfStale(FILTERS, {
      getLibraryStats: async () => ({ count: 2, latestUpdatedAt: "new" }),
      listTracks,
    });

    assert.equal(listTracks.mock.callCount(), 1);
    assert.equal(result.skipReplace, false);
    assert.equal(result.items, fresh);
  });
});
