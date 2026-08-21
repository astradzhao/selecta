import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SubmissionExtractionStatus } from "./types";
import {
  partitionSubmissions,
  submissionNeedsReview,
  submissionSubtitle,
  type SubmissionRowInput,
} from "./submission-row";

function row(
  status: SubmissionExtractionStatus,
  extras: Partial<SubmissionRowInput> = {},
): SubmissionRowInput {
  return {
    extractionStatus: status,
    extractionError: null,
    extractionVersion: 1,
    model: null,
    proposalCounts: { committed: 0, needsReview: 0, failed: 0, total: 0 },
    ...extras,
  };
}

describe("submissionNeedsReview", () => {
  it("treats open proposal review and the needs-review status as the queue", () => {
    assert.equal(
      submissionNeedsReview(
        row("partially_committed", {
          proposalCounts: { committed: 1, needsReview: 1, failed: 0, total: 2 },
        }),
      ),
      true,
    );
    assert.equal(submissionNeedsReview(row("needs_review")), true);
    assert.equal(submissionNeedsReview(row("committed")), false);
    assert.equal(submissionNeedsReview(row("failed")), false);
  });
});

describe("partitionSubmissions", () => {
  it("pins review work to the front without reshuffling either group", () => {
    const done = { id: "done", ...row("committed") };
    const partial = {
      id: "partial",
      ...row("partially_committed", {
        proposalCounts: { committed: 1, needsReview: 1, failed: 0, total: 2 },
      }),
    };
    const queued = {
      id: "queued",
      ...row("needs_review", {
        proposalCounts: { committed: 0, needsReview: 2, failed: 0, total: 2 },
      }),
    };
    const failed = { id: "failed", ...row("failed") };

    const { review, recent } = partitionSubmissions([done, partial, failed, queued]);
    assert.deepEqual(
      review.map((item) => item.id),
      ["partial", "queued"],
    );
    assert.deepEqual(
      recent.map((item) => item.id),
      ["done", "failed"],
    );
  });
});

describe("submissionSubtitle", () => {
  it("names the in-progress and terminal states instead of repeating the badge", () => {
    assert.deepEqual(submissionSubtitle(row("extracting")), [{ text: "Extracting…" }]);
    assert.deepEqual(submissionSubtitle(row("resolving")), [{ text: "Resolving…" }]);
    assert.deepEqual(submissionSubtitle(row("dismissed")), [
      { text: "Dismissed before extraction" },
    ]);
    assert.deepEqual(submissionSubtitle(row("no_proposal")), [{ text: "No transition found" }]);
  });

  it("surfaces the extraction error, falling back when the payload has none", () => {
    assert.deepEqual(
      submissionSubtitle(
        row("failed", { extractionError: "  No transition found in this note  " }),
      ),
      [{ text: "No transition found in this note", tone: "destructive" }],
    );
    assert.deepEqual(submissionSubtitle(row("commit_failed")), [
      { text: "Extraction failed", tone: "destructive" },
    ]);
  });

  it("adds proposal counts, failed commits, and the model only once committed", () => {
    assert.deepEqual(
      submissionSubtitle(
        row("needs_review", {
          proposalCounts: { committed: 0, needsReview: 1, failed: 0, total: 1 },
        }),
      ),
      [{ text: "1 proposal" }],
    );
    assert.deepEqual(
      submissionSubtitle(
        row("needs_review", {
          proposalCounts: { committed: 0, needsReview: 2, failed: 0, total: 3 },
          model: "claude-sonnet-4",
          extractionVersion: 2,
        }),
      ),
      [{ text: "3 proposals" }],
    );
    assert.deepEqual(
      submissionSubtitle(
        row("partially_committed", {
          proposalCounts: { committed: 1, needsReview: 1, failed: 1, total: 3 },
        }),
      ),
      [{ text: "3 proposals" }, { text: "1 commit failed", tone: "destructive" }],
    );
    assert.deepEqual(
      submissionSubtitle(
        row("committed", {
          proposalCounts: { committed: 2, needsReview: 0, failed: 0, total: 2 },
          extractionVersion: 2,
          model: "claude-sonnet-4",
        }),
      ),
      [{ text: "2 proposals" }, { text: "v2" }, { text: "claude-sonnet-4" }],
    );
  });
});
