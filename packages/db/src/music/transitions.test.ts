import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";

import { runInDbTransaction } from "../executor";
import { createNote } from "../notes";
import { isDbIntegrationEnabled, resetDbIntegrationData } from "../test-env";
import { asTransitionEdge } from "./neighborhood";
import { createTrack } from "./tracks";
import {
  commitTransitionProposal,
  createTransition,
  deleteTransitionById,
  getTransitionById,
  listTransitions,
  updateTransitionById,
} from "./transitions";

const pgIntegration = await isDbIntegrationEnabled();

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

describe("transition CRUD + AI commit", { skip: !pgIntegration }, () => {
  before(async () => {
    await resetDbIntegrationData();
  });

  it("allows parallel A→B edges with targeted update/delete", async () => {
    const suffix = randomUUID().slice(0, 8);
    const from = await createTrack({
      title: `DJ-83 From ${suffix}`,
      artists: [`DJ-83 Artist ${suffix}`],
    });
    const to = await createTrack({
      title: `DJ-83 To ${suffix}`,
      artists: [`DJ-83 Artist ${suffix}`],
    });

    const first = await createTransition({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      technique: "cut",
      intent: "energy_up",
      quality: "ok",
      notes: "first parallel",
    });
    const second = await createTransition({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      technique: "blend",
      intent: "smooth",
      quality: "great",
      notes: "second parallel",
    });

    assert.notEqual(first.id, second.id);
    assert.equal(first.from.track.id, from.track.id);
    assert.equal(first.to.track.id, to.track.id);

    const listed = await listTransitions({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
    });
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
    assert.equal(sibling!.edge.quality, "great");
    assert.equal(sibling!.edge.notes, "second parallel");

    await deleteTransitionById(first.id);
    assert.equal(await getTransitionById(first.id), null);
    const siblingAfterDelete = await getTransitionById(second.id);
    assert.ok(siblingAfterDelete);
    assert.equal(siblingAfterDelete!.edge.notes, "second parallel");
  });

  it("keeps AI commit idempotent on proposal_key", async () => {
    const suffix = randomUUID().slice(0, 8);
    const from = await createTrack({
      title: `DJ-83 AI From ${suffix}`,
      artists: [`DJ-83 AI Artist ${suffix}`],
    });
    const to = await createTrack({
      title: `DJ-83 AI To ${suffix}`,
      artists: [`DJ-83 AI Artist ${suffix}`],
    });
    const note = await createNote({ rawText: `DJ-83 commit note ${suffix}` });
    const proposalKey = `dj83-test:${randomUUID()}:span:fp`;

    const first = await commitTransitionProposal({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      proposalKey,
      sourceNoteId: note.id,
      sourceNoteVersion: 1,
      quality: "ok",
      notes: "ai edge",
    });
    assert.equal(first.created, true);
    assert.ok(first.id);
    assert.equal(first.properties.notes, "ai edge");

    const retry = await commitTransitionProposal({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      proposalKey,
      sourceNoteId: note.id,
      sourceNoteVersion: 1,
      quality: "great",
      notes: "should not replace",
    });
    assert.equal(retry.created, false);
    assert.equal(retry.id, first.id);
    assert.equal(retry.properties.notes, "ai edge");

    const otherKey = `${proposalKey}:other`;
    const second = await commitTransitionProposal({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      proposalKey: otherKey,
      sourceNoteId: note.id,
      sourceNoteVersion: 1,
      notes: "distinct key",
    });
    assert.equal(second.created, true);
    assert.ok(second.id);
    assert.notEqual(second.id, first.id);
  });

  it("listTransitions source filter distinguishes manual vs ai", async () => {
    const suffix = randomUUID().slice(0, 8);
    const from = await createTrack({
      title: `DJ-83 Src From ${suffix}`,
      artists: [`DJ-83 Src Artist ${suffix}`],
    });
    const to = await createTrack({
      title: `DJ-83 Src To ${suffix}`,
      artists: [`DJ-83 Src Artist ${suffix}`],
    });
    const note = await createNote({ rawText: `DJ-83 source filter ${suffix}` });

    const manual = await createTransition({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      notes: `manual ${suffix}`,
    });
    const ai = await commitTransitionProposal({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      proposalKey: `dj83-src:${suffix}:span:fp`,
      sourceNoteId: note.id,
      sourceNoteVersion: 1,
      notes: `ai ${suffix}`,
    });
    assert.ok(ai.id);

    const manuals = await listTransitions({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      source: "manual",
    });
    assert.ok(manuals.transitions.some((row) => row.id === manual.id));
    assert.ok(!manuals.transitions.some((row) => row.id === ai.id));

    const ais = await listTransitions({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      source: "ai",
    });
    assert.ok(ais.transitions.some((row) => row.id === ai.id));
    assert.ok(!ais.transitions.some((row) => row.id === manual.id));
  });

  it("rolls back commitTransitionProposal when the surrounding transaction fails", async () => {
    const suffix = randomUUID().slice(0, 8);
    const from = await createTrack({
      title: `DJ-84 From ${suffix}`,
      artists: [`DJ-84 Artist ${suffix}`],
    });
    const to = await createTrack({
      title: `DJ-84 To ${suffix}`,
      artists: [`DJ-84 Artist ${suffix}`],
    });
    const note = await createNote({
      rawText: `DJ-84 transactional rollback ${suffix}`,
    });
    const proposalKey = `dj-84-tx-${suffix}`;

    await assert.rejects(async () => {
      await runInDbTransaction(async () => {
        const result = await commitTransitionProposal({
          fromTrackId: from.track.id,
          toTrackId: to.track.id,
          proposalKey,
          sourceNoteId: note.id,
          sourceNoteVersion: 1,
          technique: "cut",
        });
        assert.equal(result.created, true);
        throw new Error("forced failure after transition insert");
      });
    }, /forced failure after transition insert/);

    const listed = await listTransitions({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      source: "ai",
    });
    assert.equal(
      listed.transitions.filter((row) => row.edge.proposalKey === proposalKey).length,
      0,
    );
  });
});
