import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  commitVocabValue,
  filterVocabOptions,
  TECHNIQUE_OPTIONS,
  vocabLabel,
} from "./vocab-labels";

describe("filterVocabOptions", () => {
  it("matches High-pass and Low-pass when the query is pass", () => {
    const hits = filterVocabOptions("pass", TECHNIQUE_OPTIONS).map((option) => option.value);
    assert.deepEqual(hits, ["high_pass_filter", "low_pass_filter"]);
  });
});

describe("commitVocabValue", () => {
  it("writes the token when the typed string is a known label", () => {
    assert.equal(commitVocabValue("High-pass filter", TECHNIQUE_OPTIONS), "high_pass_filter");
  });

  it("keeps a known token as the token", () => {
    assert.equal(commitVocabValue("high_pass_filter", TECHNIQUE_OPTIONS), "high_pass_filter");
  });

  it("round-trips custom mix text instead of canonicalizing it", () => {
    assert.equal(commitVocabValue("filter fade", TECHNIQUE_OPTIONS), "filter fade");
  });

  it("trims whitespace-only input to empty", () => {
    assert.equal(commitVocabValue("  ", TECHNIQUE_OPTIONS), "");
  });
});

describe("vocabLabel", () => {
  it("renders the human label for a known token and the raw string otherwise", () => {
    assert.equal(vocabLabel("high_pass_filter"), "High-pass filter");
    assert.equal(vocabLabel("bass_swap"), "Bass swap");
    assert.equal(vocabLabel("ok"), "OK");
    assert.equal(vocabLabel("filter fade"), "filter fade");
  });

  it("drops underscores on unknown snake_case instead of showing the token", () => {
    assert.equal(vocabLabel("filter_fade"), "Filter fade");
  });
});
