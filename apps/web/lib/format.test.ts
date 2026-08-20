import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatTimestamp, previewText } from "./format";

describe("previewText", () => {
  it("returns the fallback when input is empty or whitespace", () => {
    assert.equal(
      previewText("", { maxLength: 120, fallback: "Empty submission" }),
      "Empty submission",
    );
    assert.equal(
      previewText("   \n  ", { maxLength: 120, fallback: "Empty submission" }),
      "Empty submission",
    );
  });

  it("uses only the first line", () => {
    assert.equal(
      previewText("first line\nsecond line", { maxLength: 120, fallback: "Empty" }),
      "first line",
    );
  });

  it("truncates at maxLength - 3 and appends an ellipsis", () => {
    const text = "a".repeat(121);
    assert.equal(previewText(text, { maxLength: 120, fallback: "Empty" }), `${"a".repeat(117)}…`);
  });

  it("does not truncate strings at the maxLength boundary", () => {
    const text = "a".repeat(120);
    assert.equal(previewText(text, { maxLength: 120, fallback: "Empty" }), text);
  });
});

describe("formatTimestamp", () => {
  it("returns the raw string when the ISO input is invalid", () => {
    assert.equal(formatTimestamp("not-a-date"), "not-a-date");
    assert.equal(formatTimestamp(""), "");
  });

  it("formats a valid ISO timestamp instead of echoing it", () => {
    const formatted = formatTimestamp("2026-01-15T12:00:00.000Z");
    assert.notEqual(formatted, "2026-01-15T12:00:00.000Z");
    assert.notEqual(formatted, "Invalid Date");
  });
});
