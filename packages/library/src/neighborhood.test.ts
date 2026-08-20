import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compareNeighborhoodNeighbors,
  rankNeighborhoodNeighbors,
  transitionQualityRank,
  type FlatNeighborhoodNeighbor,
  type RankableNeighbor,
} from "./neighborhood";
import type { TrackNode } from "./types";

function track(partial: Pick<TrackNode, "id" | "title">): TrackNode {
  return {
    bpm: null,
    musicalKey: null,
    durationSec: null,
    energy: null,
    artworkUrl: null,
    releaseDate: null,
    externalIds: {},
    libraryId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function rankable(
  id: string,
  title: string,
  transition: Partial<RankableNeighbor["transition"]> = {},
): RankableNeighbor {
  return {
    track: track({ id, title }),
    transition: {
      id: `edge:${id}:${transition.proposalKey ?? "default"}`,
      proposalKey: `key:${id}`,
      sourceSubmissionId: null,
      sourceSubmissionVersion: null,
      sourceProposalId: null,
      confidence: null,
      fromBar: null,
      toBar: null,
      barsOverlap: null,
      technique: null,
      intent: null,
      quality: null,
      notes: null,
      createdAt: null,
      updatedAt: null,
      ...transition,
    },
  };
}

function flat(
  id: string,
  title: string,
  transition: Partial<FlatNeighborhoodNeighbor["transition"]> = {},
): FlatNeighborhoodNeighbor {
  const row = rankable(id, title, transition);
  return {
    track: row.track,
    artists: [],
    genres: [],
    subgenres: [],
    folders: [],
    transition: row.transition,
  };
}

describe("transitionQualityRank", () => {
  it("orders great < ok < risky < unknown", () => {
    assert.equal(transitionQualityRank("great"), 0);
    assert.equal(transitionQualityRank("ok"), 1);
    assert.equal(transitionQualityRank("risky"), 2);
    assert.equal(transitionQualityRank(null), 3);
    assert.equal(transitionQualityRank("mystery"), 3);
    assert.ok(transitionQualityRank("great") < transitionQualityRank("ok"));
    assert.ok(transitionQualityRank("ok") < transitionQualityRank("risky"));
  });
});

describe("compareNeighborhoodNeighbors", () => {
  it("prefers higher quality over confidence", () => {
    const great = rankable("a", "Zulu", { quality: "great", confidence: 0.1 });
    const ok = rankable("b", "Alpha", { quality: "ok", confidence: 0.99 });
    assert.ok(compareNeighborhoodNeighbors(great, ok) < 0);
  });

  it("breaks quality ties with higher confidence first", () => {
    const high = rankable("a", "Same", { quality: "ok", confidence: 0.9 });
    const low = rankable("b", "Same", { quality: "ok", confidence: 0.2 });
    assert.ok(compareNeighborhoodNeighbors(high, low) < 0);
  });

  it("prefers known confidence over null", () => {
    const known = rankable("a", "Same", { quality: "ok", confidence: 0.1 });
    const unknown = rankable("b", "Same", { quality: "ok", confidence: null });
    assert.ok(compareNeighborhoodNeighbors(known, unknown) < 0);
  });

  it("breaks remaining ties with earlier fromBar then title", () => {
    const early = rankable("a", "Zulu", { quality: "ok", fromBar: 8 });
    const late = rankable("b", "Alpha", { quality: "ok", fromBar: 32 });
    assert.ok(compareNeighborhoodNeighbors(early, late) < 0);

    const alpha = rankable("c", "Alpha", { quality: "ok", fromBar: 16 });
    const zulu = rankable("d", "Zulu", { quality: "ok", fromBar: 16 });
    assert.ok(compareNeighborhoodNeighbors(alpha, zulu) < 0);
  });
});

describe("rankNeighborhoodNeighbors", () => {
  it("keeps all edges per destination, ordered; groups ordered by best edge", () => {
    const ranked = rankNeighborhoodNeighbors([
      flat("dup", "Dup", { quality: "ok", confidence: 0.5, proposalKey: "worse" }),
      flat("dup", "Dup", { quality: "great", confidence: 0.2, proposalKey: "best" }),
      flat("other", "Other", { quality: "risky", proposalKey: "other" }),
    ]);

    assert.equal(ranked.length, 2);
    assert.equal(ranked[0]?.track.id, "dup");
    assert.equal(ranked[0]?.transitions.length, 2);
    assert.equal(ranked[0]?.transitions[0]?.proposalKey, "best");
    assert.equal(ranked[0]?.transitions[1]?.proposalKey, "worse");
    assert.equal(ranked[1]?.track.id, "other");
    assert.equal(ranked[1]?.transitions.length, 1);
    assert.equal(ranked[1]?.transitions[0]?.proposalKey, "other");
  });
});
