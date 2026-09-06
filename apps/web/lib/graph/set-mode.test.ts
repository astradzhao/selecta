import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyHop,
  insertPositionOnOwner,
  pinsForIndex,
  playPathFromExpansion,
  playPathIndex,
  skipSpanForOffscript,
  snapBackIndex,
  type PlayPosition,
  type UpcomingAlternate,
} from "./set-mode";
import type { SequenceExpansionEntry } from "@/lib/sequences/types";

function position(
  partial: Partial<PlayPosition> & Pick<PlayPosition, "stepId" | "trackId">,
): PlayPosition {
  return {
    sequenceId: "seq",
    depth: 0,
    inTransitionId: null,
    inBlockId: null,
    isSeam: false,
    title: partial.trackId.toUpperCase(),
    artists: [],
    artworkUrl: null,
    ...partial,
  };
}

describe("playPathFromExpansion", () => {
  it("keys two entries with the same track by step id", () => {
    const entries: SequenceExpansionEntry[] = [
      {
        stepId: "s1",
        trackId: "a",
        sequenceId: "seq",
        depth: 0,
        inTransitionId: null,
        inBlockId: null,
        isSeam: false,
        track: {
          id: "a",
          title: "A",
          artists: ["DJ"],
          artworkUrl: null,
          bpm: null,
          musicalKey: null,
          durationSec: null,
        },
      },
      {
        stepId: "s3",
        trackId: "a",
        sequenceId: "seq",
        depth: 0,
        inTransitionId: "t-ba",
        inBlockId: null,
        isSeam: false,
        track: {
          id: "a",
          title: "A",
          artists: ["DJ"],
          artworkUrl: null,
          bpm: null,
          musicalKey: null,
          durationSec: null,
        },
      },
    ];
    const path = playPathFromExpansion(entries);
    assert.equal(path[0]!.trackId, path[1]!.trackId);
    assert.notEqual(path[0]!.stepId, path[1]!.stepId);
    assert.equal(playPathIndex(path, "s3"), 1);
  });
});

describe("classifyHop", () => {
  const path = [
    position({ stepId: "s1", trackId: "a" }),
    position({ stepId: "s2", trackId: "b" }),
    position({ stepId: "s3", trackId: "a" }),
  ];

  it("treats the next track as on-script even if the transition id differs", () => {
    assert.equal(
      classifyHop({
        path,
        index: 0,
        destinationTrackId: "b",
        upcomingAlternateDestinations: [],
      }),
      "on-script",
    );
  });

  it("treats an upcoming alternate's first track as an alternate hop", () => {
    assert.equal(
      classifyHop({
        path,
        index: 0,
        destinationTrackId: "x",
        upcomingAlternateDestinations: ["x"],
      }),
      "alternate",
    );
  });

  it("does not nag when the upcoming gap is a seam", () => {
    const seamed = [
      position({ stepId: "s1", trackId: "a" }),
      position({ stepId: "s2", trackId: "b", isSeam: true }),
    ];
    assert.equal(
      classifyHop({
        path: seamed,
        index: 0,
        destinationTrackId: "z",
        upcomingAlternateDestinations: [],
      }),
      "seam",
    );
  });

  it("classifies a wander as off-script", () => {
    assert.equal(
      classifyHop({
        path,
        index: 0,
        destinationTrackId: "opus",
        upcomingAlternateDestinations: [],
      }),
      "off-script",
    );
  });

  it("does not confuse a later duplicate of the current track with the next step", () => {
    assert.equal(
      classifyHop({
        path,
        index: 0,
        destinationTrackId: "a",
        upcomingAlternateDestinations: [],
      }),
      "off-script",
    );
  });
});

describe("pinsForIndex", () => {
  const path = [
    position({ stepId: "s1", trackId: "a" }),
    position({ stepId: "s2", trackId: "b", inTransitionId: "t-ab", title: "Strobe" }),
  ];

  it("omits an on-script pin when the upcoming gap is a seam", () => {
    const seamed = [
      position({ stepId: "s1", trackId: "a" }),
      position({ stepId: "s2", trackId: "b", isSeam: true }),
    ];
    assert.deepEqual(
      pinsForIndex({ path: seamed, index: 0, currentTrackId: "a", upcomingAlts: [] }),
      [],
    );
  });

  it("merges a same-destination alternate onto the on-script pin", () => {
    const alts: UpcomingAlternate[] = [
      {
        id: "alt-1",
        label: "if the room is hot",
        valid: true,
        firstTrackId: "b",
        firstStepId: "s2",
        title: "Strobe",
        artists: [],
        artworkUrl: null,
      },
    ];
    const pins = pinsForIndex({ path, index: 0, currentTrackId: "a", upcomingAlts: alts });
    assert.equal(pins.length, 1);
    assert.equal(pins[0]!.onScript, true);
    assert.equal(pins[0]!.plannedTransitionId, "t-ab");
    assert.deepEqual(pins[0]!.alternates, [{ id: "alt-1", label: "if the room is hot" }]);
  });
});

describe("skipSpanForOffscript", () => {
  const steps = [
    { id: "s1", trackId: "a" },
    { id: "s2", trackId: "b" },
    { id: "s3", trackId: "c" },
  ];

  it("spans from the upcoming step to a later matching track", () => {
    assert.deepEqual(skipSpanForOffscript(steps, "s2", "c"), {
      fromStepId: "s2",
      toStepId: "s3",
    });
  });

  it("returns null when the destination is not on the owner", () => {
    assert.equal(skipSpanForOffscript(steps, "s2", "opus"), null);
  });

  it("returns null when the destination is the upcoming track itself", () => {
    assert.equal(skipSpanForOffscript(steps, "s2", "b"), null);
  });
});

describe("insertPositionOnOwner", () => {
  const steps = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];

  it("uses the spine index, not a flattened play-path index", () => {
    assert.equal(insertPositionOnOwner(steps, "s1"), 1);
    assert.equal(insertPositionOnOwner(steps, "s3"), 3);
    assert.equal(insertPositionOnOwner(steps, "missing"), null);
  });
});

describe("snapBackIndex", () => {
  const path = [
    position({ stepId: "s1", trackId: "a" }),
    position({ stepId: "s2", trackId: "b", isSeam: true }),
    position({ stepId: "s3", trackId: "c" }),
  ];

  it("resumes at the first matching track after the seam", () => {
    assert.equal(snapBackIndex(path, 0, "c"), 2);
    assert.equal(snapBackIndex(path, 0, "missing"), null);
  });
});
