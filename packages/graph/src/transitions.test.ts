import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { closeDriver, isNeo4jConfigured } from "./client";
import { asTransitionEdge } from "./neighborhood";
import { createTrack } from "./writes/track-writes";
import {
  createTransition,
  deleteTransitionById,
  getTransitionById,
  listTransitions,
  updateTransitionById,
} from "./writes/transition-crud";
import { commitTransitionProposal } from "./writes/transition-writes";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "../..");
for (const file of [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")]) {
  if (existsSync(file)) {
    config({ path: file, quiet: true });
    break;
  }
}

describe("asTransitionEdge", () => {
  it("maps stable id and sourceProposalId", () => {
    const edge = asTransitionEdge({
      id: "edge-1",
      proposalKey: "note:1:span:abc",
      sourceNoteId: "note-1",
      sourceNoteVersion: 2,
      sourceProposalId: "proposal-1",
      quality: "great",
    });
    assert.equal(edge.id, "edge-1");
    assert.equal(edge.sourceProposalId, "proposal-1");
    assert.equal(edge.proposalKey, "note:1:span:abc");
  });

  it("returns null identity fields when props missing", () => {
    const edge = asTransitionEdge(null);
    assert.equal(edge.id, null);
    assert.equal(edge.sourceProposalId, null);
  });
});

const neo4jReady = isNeo4jConfigured();

describe("transition CRUD + parallel edges", { skip: !neo4jReady }, () => {
  let fromTrackId = "";
  let toTrackId = "";
  const createdTransitionIds: string[] = [];

  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    const from = await createTrack({
      title: `DJ-73 From ${suffix}`,
      artists: [`DJ-73 Artist ${suffix}`],
    });
    const to = await createTrack({
      title: `DJ-73 To ${suffix}`,
      artists: [`DJ-73 Artist ${suffix}`],
    });
    fromTrackId = from.track.id;
    toTrackId = to.track.id;
  });

  after(async () => {
    for (const id of createdTransitionIds) {
      try {
        await deleteTransitionById(id);
      } catch {
        // already deleted
      }
    }
    await closeDriver();
  });

  it("allows parallel A→B edges with distinct ids and targeted update/delete", async () => {
    const first = await createTransition({
      fromTrackId,
      toTrackId,
      technique: "cut",
      intent: "energy_up",
      quality: "ok",
      notes: "first parallel",
    });
    const second = await createTransition({
      fromTrackId,
      toTrackId,
      technique: "blend",
      intent: "smooth",
      quality: "great",
      notes: "second parallel",
    });
    createdTransitionIds.push(first.id, second.id);

    assert.notEqual(first.id, second.id);
    assert.equal(first.from.track.id, fromTrackId);
    assert.equal(first.to.track.id, toTrackId);

    const listed = await listTransitions({ fromTrackId, toTrackId });
    const listedIds = new Set(listed.transitions.map((row) => row.id));
    assert.ok(listedIds.has(first.id));
    assert.ok(listedIds.has(second.id));

    const updated = await updateTransitionById(first.id, {
      quality: "risky",
      notes: "edited first only",
    });
    assert.equal(updated.edge.quality, "risky");
    assert.equal(updated.edge.notes, "edited first only");

    const sibling = await getTransitionById(second.id);
    assert.ok(sibling);
    assert.equal(sibling.edge.quality, "great");
    assert.equal(sibling.edge.notes, "second parallel");

    await deleteTransitionById(first.id);
    createdTransitionIds.splice(createdTransitionIds.indexOf(first.id), 1);

    assert.equal(await getTransitionById(first.id), null);
    const siblingAfterDelete = await getTransitionById(second.id);
    assert.ok(siblingAfterDelete);
    assert.equal(siblingAfterDelete.edge.notes, "second parallel");
  });

  it("keeps AI commit idempotent on proposalKey and assigns id + sourceProposalId", async () => {
    const proposalKey = `dj73-test:${randomUUID()}:span:fp`;
    const first = await commitTransitionProposal({
      fromTrackId,
      toTrackId,
      proposalKey,
      sourceNoteId: "note-dj73",
      sourceNoteVersion: 1,
      sourceProposalId: "proposal-dj73",
      quality: "ok",
      notes: "ai edge",
    });
    assert.equal(first.created, true);
    assert.ok(first.id);
    if (first.id) createdTransitionIds.push(first.id);
    assert.equal(first.properties.sourceProposalId, "proposal-dj73");

    const retry = await commitTransitionProposal({
      fromTrackId,
      toTrackId,
      proposalKey,
      sourceNoteId: "note-dj73",
      sourceNoteVersion: 1,
      sourceProposalId: "proposal-dj73-retry",
      quality: "great",
      notes: "should not replace",
    });
    assert.equal(retry.created, false);
    assert.equal(retry.id, first.id);
    assert.equal(retry.properties.notes, "ai edge");

    const otherKey = `${proposalKey}:other`;
    const second = await commitTransitionProposal({
      fromTrackId,
      toTrackId,
      proposalKey: otherKey,
      sourceNoteId: "note-dj73",
      sourceNoteVersion: 1,
      sourceProposalId: "proposal-dj73-b",
      notes: "distinct key",
    });
    assert.equal(second.created, true);
    assert.ok(second.id);
    assert.notEqual(second.id, first.id);
    if (second.id) createdTransitionIds.push(second.id);
  });
});
