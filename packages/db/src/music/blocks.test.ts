import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";

import { isMusicWriteError } from "./errors";
import { isDbIntegrationEnabled, resetDbIntegrationData } from "../test-env";
import { alternateSpansOverlap } from "./blocks";
import {
  addSequenceStep,
  createSequence,
  createSequenceAlternate,
  createSequenceVersion,
  deleteSequence,
  detachSequenceStep,
  getSequenceDetail,
  reorderSequence,
  updateSequenceStep,
} from "./blocks";
import { createTrack } from "./tracks";
import { createTransition, deleteTransitionById } from "./transitions";

const pgIntegration = await isDbIntegrationEnabled();

async function track(label: string) {
  const suffix = randomUUID().slice(0, 8);
  return createTrack({
    title: `${label} ${suffix}`,
    artists: [`Seq Artist ${suffix}`],
  });
}

function stepByTrack(detail: Awaited<ReturnType<typeof getSequenceDetail>>, trackId: string) {
  const matches = detail.steps.filter((step) => step.trackId === trackId);
  assert.ok(matches.length >= 1, `expected a step for track ${trackId}`);
  return matches[0]!;
}

describe("alternateSpansOverlap", () => {
  it("detects inclusive index overlap and allows adjacent spans", () => {
    assert.equal(alternateSpansOverlap({ fromIdx: 1, toIdx: 2 }, { fromIdx: 2, toIdx: 3 }), true);
    assert.equal(alternateSpansOverlap({ fromIdx: 1, toIdx: 1 }, { fromIdx: 2, toIdx: 3 }), false);
  });
});

describe("sequence module invariants", { skip: !pgIntegration }, () => {
  before(async () => {
    await resetDbIntegrationData();
  });

  it("reorder invalidates connectors whose endpoints no longer match", async () => {
    const a = await track("A");
    const b = await track("B");
    const c = await track("C");
    const ab = await createTransition({ fromTrackId: a.track.id, toTrackId: b.track.id });
    const bc = await createTransition({ fromTrackId: b.track.id, toTrackId: c.track.id });

    const sequence = await createSequence({
      title: `Reorder ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id, c.track.id] },
    });
    const stepB = stepByTrack(sequence, b.track.id);
    const stepC = stepByTrack(sequence, c.track.id);
    await updateSequenceStep(sequence.id, stepB.id, { inTransitionId: ab.id });
    await updateSequenceStep(sequence.id, stepC.id, { inTransitionId: bc.id });

    const linked = await getSequenceDetail(sequence.id);
    assert.equal(linked.isComplete, true);
    assert.equal(stepByTrack(linked, b.track.id).gapState, "linked");
    assert.equal(stepByTrack(linked, c.track.id).gapState, "linked");

    const reordered = await reorderSequence(sequence.id, [
      linked.steps[0]!.id,
      linked.steps[2]!.id,
      linked.steps[1]!.id,
    ]);
    assert.equal(reordered.isComplete, false);
    assert.notEqual(stepByTrack(reordered, c.track.id).gapState, "linked");
    assert.notEqual(stepByTrack(reordered, b.track.id).gapState, "linked");
    assert.equal(stepByTrack(reordered, c.track.id).inTransitionId, null);
    assert.equal(stepByTrack(reordered, b.track.id).inTransitionId, null);
  });

  it("detects endpoint drift when a nested block's first track changes", async () => {
    const a = await track("A");
    const x = await track("X");
    const b = await track("B");
    const z = await track("Z");
    const ax = await createTransition({ fromTrackId: a.track.id, toTrackId: x.track.id });
    const xb = await createTransition({ fromTrackId: x.track.id, toTrackId: b.track.id });

    const child = await createSequence({
      title: `Child ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, x.track.id, b.track.id] },
    });
    await updateSequenceStep(child.id, stepByTrack(child, x.track.id).id, {
      inTransitionId: ax.id,
    });
    await updateSequenceStep(child.id, stepByTrack(child, b.track.id).id, {
      inTransitionId: xb.id,
    });
    const tightChild = await getSequenceDetail(child.id);
    assert.equal(tightChild.isComplete, true);

    const parent = await createSequence({
      title: `Parent ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await updateSequenceStep(parent.id, stepByTrack(parent, b.track.id).id, {
      inBlockId: child.id,
    });
    const linked = await getSequenceDetail(parent.id);
    assert.equal(linked.isComplete, true);
    assert.equal(stepByTrack(linked, b.track.id).gapState, "linked");

    await updateSequenceStep(child.id, child.steps[0]!.id, { trackId: z.track.id });
    const drifted = await getSequenceDetail(parent.id);
    assert.equal(drifted.isComplete, false);
    assert.notEqual(stepByTrack(drifted, b.track.id).gapState, "linked");
  });

  it("propagates completeness to ancestors when a nested block breaks", async () => {
    const a = await track("A");
    const x = await track("X");
    const b = await track("B");
    const ax = await createTransition({ fromTrackId: a.track.id, toTrackId: x.track.id });
    const xb = await createTransition({ fromTrackId: x.track.id, toTrackId: b.track.id });

    const child = await createSequence({
      title: `Nested ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, x.track.id, b.track.id] },
    });
    await updateSequenceStep(child.id, stepByTrack(child, x.track.id).id, {
      inTransitionId: ax.id,
    });
    await updateSequenceStep(child.id, stepByTrack(child, b.track.id).id, {
      inTransitionId: xb.id,
    });

    const parent = await createSequence({
      title: `Ancestor ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await updateSequenceStep(parent.id, stepByTrack(parent, b.track.id).id, {
      inBlockId: child.id,
    });
    assert.equal((await getSequenceDetail(parent.id)).isComplete, true);

    await updateSequenceStep(child.id, stepByTrack(child, x.track.id).id, {
      inTransitionId: null,
    });
    assert.equal((await getSequenceDetail(child.id)).isComplete, false);
    assert.equal((await getSequenceDetail(parent.id)).isComplete, false);
  });

  it("rejects cyclic block connectors", async () => {
    const a = await track("A");
    const b = await track("B");

    const first = await createSequence({
      title: `Cycle A ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    const second = await createSequence({
      title: `Cycle B ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await updateSequenceStep(second.id, stepByTrack(second, b.track.id).id, {
      inBlockId: first.id,
    });

    await assert.rejects(
      () =>
        updateSequenceStep(first.id, stepByTrack(first, b.track.id).id, {
          inBlockId: second.id,
        }),
      (error: unknown) => isMusicWriteError(error) && /cycle/.test((error as Error).message),
    );

    await assert.rejects(
      () =>
        updateSequenceStep(first.id, stepByTrack(first, b.track.id).id, {
          inBlockId: first.id,
        }),
      (error: unknown) => isMusicWriteError(error) && /itself/.test((error as Error).message),
    );
  });

  it("keeps version choices anchored to step ids across insert and reorder", async () => {
    const a = await track("A");
    const b = await track("B");
    const c = await track("C");
    const d = await track("D");
    const ab = await createTransition({ fromTrackId: a.track.id, toTrackId: b.track.id });
    const abAlt = await createTransition({
      fromTrackId: a.track.id,
      toTrackId: b.track.id,
      technique: "cut",
    });
    const bc = await createTransition({ fromTrackId: b.track.id, toTrackId: c.track.id });

    const sequence = await createSequence({
      title: `Version ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id, c.track.id] },
    });
    const stepB = stepByTrack(sequence, b.track.id);
    const stepC = stepByTrack(sequence, c.track.id);
    await updateSequenceStep(sequence.id, stepB.id, { inTransitionId: ab.id });
    await updateSequenceStep(sequence.id, stepC.id, { inTransitionId: bc.id });

    const withAlt = await createSequenceAlternate(sequence.id, {
      fromStepId: stepB.id,
      toStepId: stepB.id,
      label: "if the room is hot",
      altTransitionId: abAlt.id,
    });
    const alternateId = withAlt.alternates[0]!.id;
    const versioned = await createSequenceVersion(sequence.id, {
      name: "hot room",
      alternateIds: [alternateId],
    });
    const versionId = versioned.versions[0]!.id;

    await addSequenceStep(sequence.id, {
      trackId: d.track.id,
      position: 1,
    });
    const afterInsert = await getSequenceDetail(sequence.id);
    assert.equal(afterInsert.versions[0]!.alternateIds[0], alternateId);
    assert.equal(afterInsert.alternates[0]!.fromStepId, stepB.id);

    const reordered = await reorderSequence(sequence.id, [
      ...afterInsert.steps.map((step) => step.id).reverse(),
    ]);
    assert.equal(reordered.versions[0]!.alternateIds[0], alternateId);
    assert.equal(reordered.alternates[0]!.fromStepId, stepB.id);
    assert.equal(reordered.versions[0]!.id, versionId);
  });

  it("rejects overlapping alternates in a single version", async () => {
    const a = await track("A");
    const b = await track("B");
    const c = await track("C");
    const ab = await createTransition({ fromTrackId: a.track.id, toTrackId: b.track.id });
    const ac = await createTransition({ fromTrackId: a.track.id, toTrackId: c.track.id });
    const bc = await createTransition({ fromTrackId: b.track.id, toTrackId: c.track.id });

    const sequence = await createSequence({
      title: `Overlap ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id, c.track.id] },
    });
    const stepB = stepByTrack(sequence, b.track.id);
    const stepC = stepByTrack(sequence, c.track.id);
    await updateSequenceStep(sequence.id, stepB.id, { inTransitionId: ab.id });
    await updateSequenceStep(sequence.id, stepC.id, { inTransitionId: bc.id });

    const one = await createSequenceAlternate(sequence.id, {
      fromStepId: stepB.id,
      toStepId: stepB.id,
      altTransitionId: ab.id,
    });
    const two = await createSequenceAlternate(sequence.id, {
      fromStepId: stepB.id,
      toStepId: stepC.id,
      altTransitionId: ac.id,
    });

    await assert.rejects(
      () =>
        createSequenceVersion(sequence.id, {
          name: "ambiguous",
          alternateIds: [
            one.alternates[0]!.id,
            two.alternates.find((alt) => alt.id !== one.alternates[0]!.id)!.id,
          ],
        }),
      (error: unknown) => isMusicWriteError(error) && /overlap/.test((error as Error).message),
    );
  });

  it("rejects reorder when the id set does not match", async () => {
    const a = await track("A");
    const b = await track("B");
    const sequence = await createSequence({
      title: `Mismatch ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await assert.rejects(
      () => reorderSequence(sequence.id, [sequence.steps[0]!.id]),
      (error: unknown) => isMusicWriteError(error) && /complete set/.test((error as Error).message),
    );
  });

  it("excludes seams from completeness", async () => {
    const a = await track("A");
    const b = await track("B");
    const c = await track("C");
    const ab = await createTransition({ fromTrackId: a.track.id, toTrackId: b.track.id });

    const sequence = await createSequence({
      title: `Seam ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id, c.track.id] },
    });
    await updateSequenceStep(sequence.id, stepByTrack(sequence, b.track.id).id, {
      inTransitionId: ab.id,
    });
    const withSeam = await updateSequenceStep(sequence.id, stepByTrack(sequence, c.track.id).id, {
      isSeam: true,
    });
    assert.equal(withSeam.isComplete, true);
    assert.equal(stepByTrack(withSeam, c.track.id).gapState, "seam");
  });

  it("deleting a transition degrades the gap instead of cascading the step", async () => {
    const a = await track("A");
    const b = await track("B");
    const ab = await createTransition({ fromTrackId: a.track.id, toTrackId: b.track.id });
    const sequence = await createSequence({
      title: `Degrade ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await updateSequenceStep(sequence.id, stepByTrack(sequence, b.track.id).id, {
      inTransitionId: ab.id,
    });
    await deleteTransitionById(ab.id);
    const after = await getSequenceDetail(sequence.id);
    assert.equal(after.steps.length, 2);
    assert.equal(stepByTrack(after, b.track.id).inTransitionId, null);
    assert.notEqual(stepByTrack(after, b.track.id).gapState, "linked");
    assert.equal(after.isComplete, false);
  });

  it("addresses a duplicate track by step id", async () => {
    const a = await track("A");
    const sequence = await createSequence({
      title: `Dup ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, a.track.id] },
    });
    assert.equal(sequence.steps.length, 2);
    assert.equal(sequence.steps[0]!.trackId, a.track.id);
    assert.equal(sequence.steps[1]!.trackId, a.track.id);
    assert.notEqual(sequence.steps[0]!.id, sequence.steps[1]!.id);

    const expanded = await getSequenceDetail(sequence.id, { expand: true });
    assert.equal(expanded.expansion?.entries.length, 2);
    assert.notEqual(expanded.expansion?.entries[0]!.stepId, expanded.expansion?.entries[1]!.stepId);
    assert.equal(expanded.expansion?.entries[0]!.trackId, a.track.id);
    assert.equal(expanded.expansion?.entries[1]!.trackId, a.track.id);
  });

  it("rejects a connector whose endpoints do not match the gap", async () => {
    const a = await track("A");
    const b = await track("B");
    const c = await track("C");
    const ac = await createTransition({ fromTrackId: a.track.id, toTrackId: c.track.id });
    const sequence = await createSequence({
      title: `Mismatch gap ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await assert.rejects(
      () =>
        updateSequenceStep(sequence.id, stepByTrack(sequence, b.track.id).id, {
          inTransitionId: ac.id,
        }),
      (error: unknown) =>
        isMusicWriteError(error) && /endpoints do not match/.test((error as Error).message),
    );
  });

  it("expands a nested block inline and detaches it to editable copies", async () => {
    const a = await track("A");
    const x = await track("X");
    const b = await track("B");
    const ax = await createTransition({ fromTrackId: a.track.id, toTrackId: x.track.id });
    const xb = await createTransition({ fromTrackId: x.track.id, toTrackId: b.track.id });

    const child = await createSequence({
      title: `Expand child ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, x.track.id, b.track.id] },
    });
    await updateSequenceStep(child.id, stepByTrack(child, x.track.id).id, {
      inTransitionId: ax.id,
    });
    await updateSequenceStep(child.id, stepByTrack(child, b.track.id).id, {
      inTransitionId: xb.id,
    });

    const parent = await createSequence({
      title: `Expand parent ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await updateSequenceStep(parent.id, stepByTrack(parent, b.track.id).id, {
      inBlockId: child.id,
    });

    const expanded = await getSequenceDetail(parent.id, { expand: true });
    assert.deepEqual(
      expanded.expansion?.entries.map((entry) => entry.trackId),
      [a.track.id, x.track.id, b.track.id],
    );

    const detached = await detachSequenceStep(parent.id, stepByTrack(parent, b.track.id).id);
    assert.equal(detached.steps.length, 3);
    assert.equal(detached.steps[1]!.trackId, x.track.id);
    assert.equal(detached.steps[1]!.inTransitionId, ax.id);
    assert.equal(detached.steps[2]!.trackId, b.track.id);
    assert.equal(detached.steps[2]!.inBlockId, null);
    assert.equal(detached.steps[2]!.inTransitionId, xb.id);
  });

  it("rejects deleting a sequence that is still used as a connector", async () => {
    const a = await track("A");
    const b = await track("B");
    const ab = await createTransition({ fromTrackId: a.track.id, toTrackId: b.track.id });
    const child = await createSequence({
      title: `Used child ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await updateSequenceStep(child.id, stepByTrack(child, b.track.id).id, {
      inTransitionId: ab.id,
    });
    const parent = await createSequence({
      title: `Used parent ${randomUUID().slice(0, 8)}`,
      seed: { trackIds: [a.track.id, b.track.id] },
    });
    await updateSequenceStep(parent.id, stepByTrack(parent, b.track.id).id, {
      inBlockId: child.id,
    });
    await assert.rejects(
      () => deleteSequence(child.id),
      (error: unknown) => isMusicWriteError(error) && error.code === "conflict",
    );
    await updateSequenceStep(parent.id, stepByTrack(parent, b.track.id).id, { inBlockId: null });
    await deleteSequence(child.id);
  });
});
