import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRACK_ROW_ARTWORK_PX } from "./track-row-item";

describe("TRACK_ROW_ARTWORK_PX", () => {
  it("documents only two artwork sizes", () => {
    assert.deepEqual(TRACK_ROW_ARTWORK_PX, { sm: 40, md: 48 });
    assert.equal(Object.keys(TRACK_ROW_ARTWORK_PX).length, 2);
  });
});
