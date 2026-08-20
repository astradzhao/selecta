import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { noteProposalStatusEnum, type NoteProposalStatus } from "@selecta/db";

import { PROPOSAL_STATUS, proposalStatus } from "./proposal-status";

describe("PROPOSAL_STATUS", () => {
  it("defines a label and tone for every schema proposal status", () => {
    for (const status of noteProposalStatusEnum.enumValues) {
      const display = proposalStatus(status);
      assert.ok(display.label.trim(), `${status} is missing a label`);
      assert.ok(display.tone, `${status} is missing a tone`);
    }
  });

  it("does not map statuses that are not in the schema enum", () => {
    const mapped = Object.keys(PROPOSAL_STATUS).sort();
    const fromSchema = [...noteProposalStatusEnum.enumValues].sort();
    assert.deepEqual(mapped, fromSchema);
  });

  it("treats committed as success and needs_review as warning, not failure", () => {
    assert.equal(proposalStatus("committed" satisfies NoteProposalStatus).tone, "success");
    assert.equal(proposalStatus("needs_review").tone, "warning");
    assert.equal(proposalStatus("failed").tone, "destructive");
    assert.equal(proposalStatus("rejected").tone, "neutral");
  });
});
