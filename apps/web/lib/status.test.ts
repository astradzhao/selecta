import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toneToBadgeVariant, type StatusTone } from "./status";

describe("toneToBadgeVariant", () => {
  it("maps semantic tones onto Badge variants without collapsing success or warning", () => {
    const expected: Record<StatusTone, ReturnType<typeof toneToBadgeVariant>> = {
      success: "success",
      warning: "warning",
      info: "info",
      destructive: "destructive",
      neutral: "secondary",
    };
    for (const [tone, variant] of Object.entries(expected) as Array<
      [StatusTone, ReturnType<typeof toneToBadgeVariant>]
    >) {
      assert.equal(toneToBadgeVariant(tone), variant);
    }
  });
});
