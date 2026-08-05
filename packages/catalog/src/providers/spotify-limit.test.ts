import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampSpotifySearchLimit,
  SPOTIFY_SEARCH_DEFAULT_LIMIT,
  SPOTIFY_SEARCH_MAX_LIMIT,
} from "./spotify";

describe("clampSpotifySearchLimit", () => {
  it("defaults when limit is missing or non-finite", () => {
    assert.equal(clampSpotifySearchLimit(undefined), SPOTIFY_SEARCH_DEFAULT_LIMIT);
    assert.equal(clampSpotifySearchLimit(Number.NaN), SPOTIFY_SEARCH_DEFAULT_LIMIT);
    assert.equal(clampSpotifySearchLimit(Number.POSITIVE_INFINITY), SPOTIFY_SEARCH_DEFAULT_LIMIT);
  });

  it("floors and clamps into Spotify /search's accepted range (1–10)", () => {
    assert.equal(SPOTIFY_SEARCH_MAX_LIMIT, 10);
    assert.equal(clampSpotifySearchLimit(0), 1);
    assert.equal(clampSpotifySearchLimit(-3), 1);
    assert.equal(clampSpotifySearchLimit(1.9), 1);
    assert.equal(clampSpotifySearchLimit(10), 10);
    // Pre-tightening docs said 50; values above 10 must never reach Spotify.
    assert.equal(clampSpotifySearchLimit(12), 10);
    assert.equal(clampSpotifySearchLimit(20), 10);
    assert.equal(clampSpotifySearchLimit(50), 10);
  });
});
