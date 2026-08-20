import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sourceFingerprint, spanProposalKey } from "./proposal-key";

describe("proposal keys", () => {
  it("builds stable fingerprint keys from normalized span text", () => {
    const fp = sourceFingerprint(0, 12, "A into B");
    const key = spanProposalKey("note-1", 2, fp);
    assert.equal(key, `note-1:2:span:${fp}`);
    assert.equal(sourceFingerprint(0, 12, "A into B"), fp);
    // Same text at different offsets must collide — prevents retry/resegment dupes.
    assert.equal(sourceFingerprint(0, 12, "A into B"), sourceFingerprint(1, 13, "A into B"));
    assert.equal(sourceFingerprint(0, 12, "A into B"), sourceFingerprint(0, 12, "  A   into B "));
  });
});
