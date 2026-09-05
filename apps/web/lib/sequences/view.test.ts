import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addTransitionHref,
  graphSetHref,
  parseSetsView,
  sequenceWorkspaceHref,
  setsViewHref,
} from "./view";

describe("parseSetsView", () => {
  it("accepts sets and blocks and coerces anything else to sets", () => {
    assert.equal(parseSetsView("sets"), "sets");
    assert.equal(parseSetsView("blocks"), "blocks");
    assert.equal(parseSetsView(undefined), "sets");
    assert.equal(parseSetsView("nights"), "sets");
    assert.equal(parseSetsView("../../evil"), "sets");
  });
});

describe("setsViewHref", () => {
  it("never interpolates an unknown view into the href", () => {
    assert.equal(setsViewHref("sets"), "/sets");
    assert.equal(setsViewHref("blocks"), "/sets?view=blocks");
    assert.equal(setsViewHref(parseSetsView("nope")), "/sets");
  });
});

describe("sequenceWorkspaceHref", () => {
  it("routes kind to the matching path", () => {
    assert.equal(sequenceWorkspaceHref("set", "abc"), "/sets/abc");
    assert.equal(sequenceWorkspaceHref("block", "abc"), "/blocks/abc");
  });
});

describe("graphSetHref", () => {
  it("puts set, version, and step on the graph URL", () => {
    assert.equal(graphSetHref("abc"), "/graph?set=abc");
    assert.equal(graphSetHref("abc", { versionId: "v1" }), "/graph?set=abc&version=v1");
    assert.equal(graphSetHref("abc", { stepId: "s1" }), "/graph?set=abc&step=s1");
  });
});

describe("addTransitionHref", () => {
  it("locks both endpoints on the library add page", () => {
    assert.equal(
      addTransitionHref("from-1", "to-2"),
      "/library/add/transitions?fromTrackId=from-1&toTrackId=to-2",
    );
  });
});
