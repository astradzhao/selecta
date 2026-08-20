import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUTO_COMMIT_CONFIDENCE_FLOOR,
  confidenceOrdinal,
  confidenceToUnitInterval,
} from "./confidence";

describe("confidence ladder", () => {
  it("auto-commits at strong and above", () => {
    assert.equal(AUTO_COMMIT_CONFIDENCE_FLOOR, "strong");
  });

  it("maps levels to a stable 0..1 scale", () => {
    assert.equal(confidenceOrdinal("none"), 0);
    assert.equal(confidenceOrdinal("full"), 5);
    assert.equal(confidenceToUnitInterval("none"), 0);
    assert.equal(confidenceToUnitInterval("full"), 1);
    assert.equal(confidenceToUnitInterval("strong"), 0.6);
  });
});
