import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sourceFingerprint, spanProposalKey } from "./proposal-key";
import { assertRawTextWithinLimit, SUBMISSION_LIMITS, utf8ByteLength } from "./limits";

describe("proposal keys", () => {
  it("builds stable fingerprint keys independent of span order", () => {
    const fp = sourceFingerprint(0, 12, "A into B");
    const key = spanProposalKey("note-1", 2, fp);
    assert.equal(key, `note-1:2:span:${fp}`);
    assert.equal(sourceFingerprint(0, 12, "A into B"), fp);
    assert.notEqual(sourceFingerprint(0, 12, "A into B"), sourceFingerprint(1, 13, "A into B"));
  });
});

describe("submission limits", () => {
  it("rejects oversized raw submissions visibly", () => {
    const oversized = "x".repeat(SUBMISSION_LIMITS.maxRawBytes + 1);
    assert.ok(utf8ByteLength(oversized) > SUBMISSION_LIMITS.maxRawBytes);
    assert.throws(() => assertRawTextWithinLimit(oversized), /exceeds max raw size/);
  });

  it("accepts submissions within the byte cap", () => {
    assert.doesNotThrow(() => assertRawTextWithinLimit("short note"));
  });
});
