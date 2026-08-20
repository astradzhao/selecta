import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canAddTag, filterTagSuggestions } from "./suggestions";

describe("canAddTag", () => {
  it("rejects blank and case-insensitive duplicates", () => {
    assert.equal(canAddTag([{ name: "UKG" }], "  "), null);
    assert.equal(canAddTag([{ name: "UKG" }], "ukg"), null);
    assert.equal(canAddTag([{ name: "UKG" }], "afro house"), "afro house");
  });
});

describe("filterTagSuggestions", () => {
  it("hides selected names and matches every draft token", () => {
    const suggestions = [{ name: "UKG" }, { name: "Afro house" }, { name: "Melodic house" }];
    assert.deepEqual(filterTagSuggestions(suggestions, [{ name: "UKG" }], "house afro", 24), [
      { name: "Afro house" },
    ]);
  });
});
