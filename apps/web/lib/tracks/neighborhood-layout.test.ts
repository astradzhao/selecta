import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { layoutNeighborhood } from "../../lib/tracks/neighborhood-layout";

describe("layoutNeighborhood", () => {
  it("places the current node on the left and neighbors in a right column", () => {
    const layout = layoutNeighborhood(["a", "b", "c"], { width: 700, height: 200 });

    assert.ok(layout.current.x < layout.width * 0.3);
    assert.equal(layout.neighbors.length, 3);
    assert.ok(layout.neighbors.every((n) => n.x > layout.current.x));
    assert.equal(layout.overflow, 0);

    const ys = layout.neighbors.map((n) => n.y);
    assert.ok(ys[0]! < ys[1]! && ys[1]! < ys[2]!);
  });

  it("centers a single neighbor vertically", () => {
    const layout = layoutNeighborhood(["only"], { width: 700, height: 200 });
    assert.equal(layout.neighbors.length, 1);
    assert.ok(Math.abs(layout.neighbors[0]!.y - layout.current.y) < 1);
  });

  it("caps drawn neighbors and reports overflow", () => {
    const ids = Array.from({ length: 15 }, (_, i) => `n${i}`);
    const layout = layoutNeighborhood(ids, { maxVisible: 10 });
    assert.equal(layout.neighbors.length, 10);
    assert.equal(layout.overflow, 5);
  });
});
