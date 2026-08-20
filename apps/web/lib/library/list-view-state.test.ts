import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyStateCopy,
  FILTERED_EMPTY_DESCRIPTION,
  formatListCount,
  listViewPhase,
} from "./list-view-state";

const COPY = {
  noneTitle: "No tracks yet",
  noneDescription: "Add a track to start building your library.",
  filteredTitle: "No matching tracks",
};

describe("listViewPhase", () => {
  it("stays in loading until the first fetch so empty copy cannot flash", () => {
    assert.equal(listViewPhase({ hasFetched: false, error: null, hasContent: false }), "loading");
  });

  it("shows the error panel only when there is nothing to render", () => {
    assert.equal(listViewPhase({ hasFetched: true, error: "down", hasContent: false }), "error");
    assert.equal(listViewPhase({ hasFetched: true, error: "down", hasContent: true }), "ready");
  });

  it("is ready for an empty fetched list so the empty state can render", () => {
    assert.equal(listViewPhase({ hasFetched: true, error: null, hasContent: false }), "ready");
  });
});

describe("emptyStateCopy", () => {
  it("keeps the CTA on a true-empty library", () => {
    assert.deepEqual(emptyStateCopy(false, COPY), {
      title: "No tracks yet",
      description: "Add a track to start building your library.",
      showAction: true,
    });
  });

  it("switches to filtered-empty copy and hides the CTA", () => {
    assert.deepEqual(emptyStateCopy(true, COPY), {
      title: "No matching tracks",
      description: FILTERED_EMPTY_DESCRIPTION,
      showAction: false,
    });
  });
});

describe("formatListCount", () => {
  it("pluralizes and marks a truncated page with a plus", () => {
    assert.equal(formatListCount(1, { singular: "track", plural: "tracks" }), "1 track");
    assert.equal(formatListCount(2, { singular: "track", plural: "tracks" }), "2 tracks");
    assert.equal(
      formatListCount(50, { singular: "submission", plural: "submissions", hasMore: true }),
      "50+ submissions",
    );
  });
});
