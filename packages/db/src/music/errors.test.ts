import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MusicWriteError, sequenceMusicWriteStatus } from "./errors";

describe("sequenceMusicWriteStatus", () => {
  it("maps sequence write codes to 404 / 409 / 422", () => {
    assert.equal(sequenceMusicWriteStatus("not_found"), 404);
    assert.equal(sequenceMusicWriteStatus("conflict"), 409);
    assert.equal(sequenceMusicWriteStatus("invalid_input"), 422);
  });

  it("carries optional conflict details", () => {
    const error = new MusicWriteError("conflict", "in use", {
      referrers: [{ id: "seq-1", title: "Night", kind: "set" }],
    });
    assert.equal(error.code, "conflict");
    assert.deepEqual(error.details?.referrers, [{ id: "seq-1", title: "Night", kind: "set" }]);
  });
});
