import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { libraryAddBackHref, libraryAddHref } from "./add-routes";

describe("libraryAddBackHref", () => {
  it("returns the recorded section when from is a known view", () => {
    assert.equal(libraryAddBackHref("transitions", "submissions"), "/library?view=transitions");
  });

  it("drops the query param when returning to the default tracks view", () => {
    assert.equal(libraryAddBackHref("tracks", "submissions"), "/library");
  });

  it("falls back to the page's own section when from is missing", () => {
    assert.equal(libraryAddBackHref(undefined, "submissions"), "/library?view=submissions");
  });

  it("discards an unrecognized from value instead of interpolating it", () => {
    assert.equal(libraryAddBackHref("../../evil", "submissions"), "/library?view=submissions");
  });
});

describe("libraryAddHref", () => {
  it("records from when it differs from the add category", () => {
    assert.equal(
      libraryAddHref("submissions", "transitions"),
      "/library/add/submissions?from=transitions",
    );
  });

  it("omits a redundant from that matches the category", () => {
    assert.equal(libraryAddHref("submissions", "submissions"), "/library/add/submissions");
  });
});
