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
    assert.equal(
      deriveSubmissionExtractionStatus(counts({ total: 3, committed: 2, needs_review: 1 })),
      "partially_committed",
    );
  });

  it("marks committed when every decided proposal committed", () => {
    assert.equal(deriveSubmissionExtractionStatus(counts({ total: 2, committed: 2 })), "committed");
  });

  it("marks no_proposal when nothing was produced", () => {
    assert.equal(deriveSubmissionExtractionStatus(counts({ total: 0 })), "no_proposal");
  });
});
