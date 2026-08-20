import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { submissionExtractionStatusEnum, type SubmissionExtractionStatus } from "@selecta/db";

import {
  EXTRACTION_STATUS,
  extractionStatus,
  SUBMISSION_STATUS_FILTER_OPTIONS,
} from "./extraction-status";

describe("EXTRACTION_STATUS", () => {
  it("defines a label and tone for every schema extraction status", () => {
    for (const status of submissionExtractionStatusEnum.enumValues) {
      const display = extractionStatus(status);
      assert.ok(display.label.trim(), `${status} is missing a label`);
      assert.ok(display.tone, `${status} is missing a tone`);
    }
  });

  it("does not map statuses that are not in the schema enum", () => {
    const mapped = Object.keys(EXTRACTION_STATUS).sort();
    const fromSchema = [...submissionExtractionStatusEnum.enumValues].sort();
    assert.deepEqual(mapped, fromSchema);
  });

  it("reuses the same labels in the submissions filter", () => {
    for (const option of SUBMISSION_STATUS_FILTER_OPTIONS) {
      if (!option.value) continue;
      assert.equal(option.label, EXTRACTION_STATUS[option.value].label);
    }
  });

  it("treats committed as success and needs_review as warning, not failure", () => {
    assert.equal(
      extractionStatus("committed" satisfies SubmissionExtractionStatus).tone,
      "success",
    );
    assert.equal(extractionStatus("needs_review").tone, "warning");
    assert.equal(extractionStatus("failed").tone, "destructive");
    assert.equal(extractionStatus("commit_failed").tone, "destructive");
  });
});
