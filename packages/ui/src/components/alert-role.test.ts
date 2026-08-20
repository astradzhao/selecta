import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { alertRole } from "./alert-role";

describe("alertRole", () => {
  it("uses role=alert for destructive and warning", () => {
    assert.equal(alertRole("destructive"), "alert");
    assert.equal(alertRole("warning"), "alert");
  });

  it("uses role=status for info and success", () => {
    assert.equal(alertRole("info"), "status");
    assert.equal(alertRole("success"), "status");
  });
});
