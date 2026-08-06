import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveSubmissionExtractionStatus, type ProposalStatusCounts } from "./proposals";

function counts(partial: Partial<ProposalStatusCounts>): ProposalStatusCounts {
  return {
    total: 0,
    queued: 0,
    parsing: 0,
    resolving: 0,
    ready: 0,
    needs_review: 0,
    committed: 0,
    failed: 0,
    rejected: 0,
    superseded: 0,
    ...partial,
  };
}

describe("deriveSubmissionExtractionStatus", () => {
  it("marks partial success when some proposals commit and others need review", () => {
    const result = deriveSubmissionExtractionStatus(
      counts({ total: 3, committed: 2, needs_review: 1 }),
    );
    assert.equal(result.extractionStatus, "partially_committed");
    assert.equal(result.noteStatus, "preview");
  });

  it("marks committed when every decided proposal committed", () => {
    const result = deriveSubmissionExtractionStatus(counts({ total: 2, committed: 2 }));
    assert.equal(result.extractionStatus, "committed");
    assert.equal(result.noteStatus, "committed");
  });

  it("marks no_proposal when nothing was produced", () => {
    const result = deriveSubmissionExtractionStatus(counts({ total: 0 }));
    assert.equal(result.extractionStatus, "no_proposal");
  });
});
