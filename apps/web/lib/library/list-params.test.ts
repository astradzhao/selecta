import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { submissionListQuery, trackListQuery, transitionListQuery } from "./list-params";

describe("trackListQuery", () => {
  it("maps all three filters and always requests 100 tracks", () => {
    assert.deepEqual(trackListQuery({ query: "sunset", subgenre: "UKG", folder: "warm" }), {
      query: "sunset",
      subgenre: "UKG",
      folder: "warm",
      limit: 100,
    });
  });
});

describe("submissionListQuery", () => {
  it("omits empty status and a false needs-review flag", () => {
    assert.deepEqual(
      submissionListQuery(
        { query: "mix", status: "", needsReviewOnly: false },
        { offset: 0, limit: 50 },
      ),
      {
        query: "mix",
        status: undefined,
        needsReview: undefined,
        limit: 50,
        offset: 0,
      },
    );
  });

  it("forwards status, needs-review, and pagination", () => {
    assert.deepEqual(
      submissionListQuery(
        { query: "", status: "needs_review", needsReviewOnly: true },
        { offset: 50, limit: 50 },
      ),
      {
        query: "",
        status: "needs_review",
        needsReview: true,
        limit: 50,
        offset: 50,
      },
    );
  });
});

describe("transitionListQuery", () => {
  it("omits an empty source so the API is not filtered to blank", () => {
    assert.deepEqual(
      transitionListQuery(
        { query: "cut", technique: "blend", intent: "energy up", source: "" },
        { offset: 0, limit: 50 },
      ),
      {
        query: "cut",
        technique: "blend",
        intent: "energy up",
        source: undefined,
        limit: 50,
        offset: 0,
      },
    );
  });

  it("forwards a selected source", () => {
    assert.equal(
      transitionListQuery(
        { query: "", technique: "", intent: "", source: "ai" },
        { offset: 0, limit: 50 },
      ).source,
      "ai",
    );
  });
});
