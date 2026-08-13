/**
 * Sequences (blocks / sets) — ordered, composable paths through the graph (DJ-111).
 *
 * Gap-state derivation, completeness, expansion, cycle checks, and staleness
 * validation live here so Graph and Library cannot disagree.
 */
import { and, asc, desc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { getExecutor, runInDbTransaction } from "../executor";
import {
  blockAlternates,
  blockSteps,
  blockVersionChoices,
  blockVersions,
  blocks,
  tracks,
  transitions,
  type BlockAlternateRow,
  type BlockKind,
  type BlockRow,
  type BlockStepRow,
  type BlockVersionRow,
} from "../schema";
import { SEQUENCE_MAX_NESTING_DEPTH, isBlockKind, type GapState } from "./constants";
import { MusicWriteError } from "./errors";
import { clampListLimit, clampListOffset, type ListPageMeta } from "./list-page";
import { optionalString, requireTrimmed } from "./shared";

export type SequenceRecord = {
  id: string;
  kind: BlockKind;
  title: string;
  description: string | null;
  startTrackId: string | null;
  endTrackId: string | null;
  isComplete: boolean;
  libraryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SequenceStep = {
  id: string;
  position: number;
  trackId: string;
  inTransitionId: string | null;
  inBlockId: string | null;
  isSeam: boolean;
  note: string | null;
  /** Null on the first step — there is no inbound gap. */
  gapState: GapState | null;
  candidateCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SequenceAlternate = {
  id: string;
  label: string | null;
  fromStepId: string;
  toStepId: string;
  altTransitionId: string | null;
  altBlockId: string | null;
  /** False when the span is no longer contiguous or the connector is stale. */
  valid: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SequenceVersion = {
  id: string;
  name: string;
  alternateIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExpandedSequenceEntry = {
  stepId: string;
  trackId: string;
  sequenceId: string;
  depth: number;
  inTransitionId: string | null;
  inBlockId: string | null;
};

export type SequenceExpansion = {
  entries: ExpandedSequenceEntry[];
  truncated: boolean;
  reason: "incomplete" | "broken" | "depth_exceeded" | null;
};

export type SequenceDetail = SequenceRecord & {
  steps: SequenceStep[];
  alternates: SequenceAlternate[];
  versions: SequenceVersion[];
  expansion: SequenceExpansion | null;
};

export type ListSequencesInput = {
  kind?: BlockKind;
  query?: string;
  complete?: boolean;
  startTrackId?: string;
  endTrackId?: string;
  limit?: number;
  offset?: number;
};

export type ListSequencesResult = {
  sequences: SequenceRecord[];
} & ListPageMeta;

export type SequenceTrailSeed = {
  trackId: string;
  inTransitionId?: string | null;
};

export type CreateSequenceInput = {
  kind?: BlockKind;
  title: string;
  description?: string | null;
  libraryId?: string | null;
  seed?: { trackIds: string[] } | { trail: SequenceTrailSeed[] };
};

export type UpdateSequenceInput = {
  kind?: BlockKind;
  title?: string;
  description?: string | null;
};

export type AddSequenceStepInput = {
  trackId: string;
  position?: number | "append";
  inTransitionId?: string | null;
  inBlockId?: string | null;
  isSeam?: boolean;
  note?: string | null;
};

export type UpdateSequenceStepInput = {
  trackId?: string;
  inTransitionId?: string | null;
  inBlockId?: string | null;
  isSeam?: boolean;
  note?: string | null;
};

export type CreateSequenceAlternateInput = {
  fromStepId: string;
  toStepId: string;
  label?: string | null;
  altTransitionId?: string | null;
  altBlockId?: string | null;
};

export type UpdateSequenceAlternateInput = {
  fromStepId?: string;
  toStepId?: string;
  label?: string | null;
  altTransitionId?: string | null;
  altBlockId?: string | null;
};

export type CreateSequenceVersionInput = {
  name: string;
  alternateIds: string[];
};

export type UpdateSequenceVersionInput = {
  name?: string;
  alternateIds?: string[];
};

export type GetSequenceDetailOptions = {
  expand?: boolean;
  versionId?: string | null;
};

export type SequenceReferrer = {
  id: string;
  title: string;
  kind: BlockKind;
};

type ConnectorRef = {
  inTransitionId: string | null;
  inBlockId: string | null;
};

function parseKind(value: string | undefined, fallback: BlockKind = "block"): BlockKind {
  if (value === undefined) {
    return fallback;
  }
  if (!isBlockKind(value)) {
    throw new MusicWriteError(
      "invalid_input",
      `Invalid sequence kind "${value}". Expected block | set.`,
    );
  }
  return value;
}

function toRecord(row: BlockRow): SequenceRecord {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description ?? null,
    startTrackId: row.startTrackId ?? null,
    endTrackId: row.endTrackId ?? null,
    isComplete: row.isComplete,
    libraryId: row.libraryId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sortSteps(rows: BlockStepRow[]): BlockStepRow[] {
  return [...rows].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

function pairKey(fromTrackId: string, toTrackId: string): string {
  return `${fromTrackId}\0${toTrackId}`;
}

function xorConnector(
  transitionId: string | null | undefined,
  blockId: string | null | undefined,
): ConnectorRef {
  const inTransitionId = optionalString(transitionId);
  const inBlockId = optionalString(blockId);
  if (inTransitionId && inBlockId) {
    throw new MusicWriteError(
      "invalid_input",
      "A step or alternate can have a transition connector or a block connector, not both.",
    );
  }
  return { inTransitionId, inBlockId };
}

function assertExclusiveConnectorPatch(input: {
  inTransitionId?: string | null;
  inBlockId?: string | null;
}): void {
  if (input.inTransitionId !== undefined && input.inBlockId !== undefined) {
    xorConnector(input.inTransitionId, input.inBlockId);
  }
}

async function requireSequenceRow(sequenceId: string): Promise<BlockRow> {
  const id = requireTrimmed(sequenceId, "sequenceId");
  const [row] = await getExecutor().select().from(blocks).where(eq(blocks.id, id)).limit(1);
  if (!row) {
    throw new MusicWriteError("not_found", `Sequence "${id}" was not found.`);
  }
  return row;
}

async function requireTrackIds(trackIds: string[]): Promise<void> {
  const unique = [...new Set(trackIds.map((id) => requireTrimmed(id, "trackId")))];
  if (unique.length === 0) {
    return;
  }
  const rows = await getExecutor()
    .select({ id: tracks.id })
    .from(tracks)
    .where(inArray(tracks.id, unique));
  const found = new Set(rows.map((row) => row.id));
  for (const id of unique) {
    if (!found.has(id)) {
      throw new MusicWriteError("not_found", `Track "${id}" was not found.`);
    }
  }
}

async function loadOrderedSteps(sequenceId: string): Promise<BlockStepRow[]> {
  const rows = await getExecutor()
    .select()
    .from(blockSteps)
    .where(eq(blockSteps.blockId, sequenceId));
  return sortSteps(rows);
}

async function loadAlternates(sequenceId: string): Promise<BlockAlternateRow[]> {
  return getExecutor()
    .select()
    .from(blockAlternates)
    .where(eq(blockAlternates.blockId, sequenceId));
}

async function loadVersions(sequenceId: string): Promise<SequenceVersion[]> {
  const versionRows = await getExecutor()
    .select()
    .from(blockVersions)
    .where(eq(blockVersions.blockId, sequenceId))
    .orderBy(asc(blockVersions.createdAt), asc(blockVersions.id));
  if (versionRows.length === 0) {
    return [];
  }
  const choiceRows = await getExecutor()
    .select()
    .from(blockVersionChoices)
    .where(
      inArray(
        blockVersionChoices.versionId,
        versionRows.map((row) => row.id),
      ),
    );
  const idsByVersion = new Map<string, string[]>();
  for (const choice of choiceRows) {
    const list = idsByVersion.get(choice.versionId) ?? [];
    list.push(choice.alternateId);
    idsByVersion.set(choice.versionId, list);
  }
  return versionRows.map((row) => toVersion(row, idsByVersion.get(row.id) ?? []));
}

function toVersion(row: BlockVersionRow, alternateIds: string[]): SequenceVersion {
  return {
    id: row.id,
    name: row.name,
    alternateIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function stepIndexById(steps: BlockStepRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    map.set(steps[i]!.id, i);
  }
  return map;
}

function spanRange(
  steps: BlockStepRow[],
  fromStepId: string,
  toStepId: string,
): { fromIdx: number; toIdx: number } | null {
  const index = stepIndexById(steps);
  const fromIdx = index.get(fromStepId);
  const toIdx = index.get(toStepId);
  if (fromIdx === undefined || toIdx === undefined || fromIdx > toIdx) {
    return null;
  }
  return { fromIdx, toIdx };
}

export function alternateSpansOverlap(
  a: { fromIdx: number; toIdx: number },
  b: { fromIdx: number; toIdx: number },
): boolean {
  return a.fromIdx <= b.toIdx && b.fromIdx <= a.toIdx;
}

async function loadTransitionEndpoints(
  transitionId: string,
): Promise<{ fromTrackId: string; toTrackId: string } | null> {
  const [row] = await getExecutor()
    .select({ fromTrackId: transitions.fromTrackId, toTrackId: transitions.toTrackId })
    .from(transitions)
    .where(eq(transitions.id, transitionId))
    .limit(1);
  return row ?? null;
}

async function loadSequenceEndpoints(
  sequenceId: string,
): Promise<{ startTrackId: string | null; endTrackId: string | null; isComplete: boolean } | null> {
  const [row] = await getExecutor()
    .select({
      startTrackId: blocks.startTrackId,
      endTrackId: blocks.endTrackId,
      isComplete: blocks.isComplete,
    })
    .from(blocks)
    .where(eq(blocks.id, sequenceId))
    .limit(1);
  return row ?? null;
}

type ConnectorValidity =
  | { valid: true; kind: "transition" | "block"; childComplete: boolean }
  | { valid: false };

async function validateConnector(
  previousTrackId: string,
  nextTrackId: string,
  connector: ConnectorRef,
): Promise<ConnectorValidity> {
  if (connector.inTransitionId && connector.inBlockId) {
    return { valid: false };
  }
  if (connector.inTransitionId) {
    const edge = await loadTransitionEndpoints(connector.inTransitionId);
    if (!edge) {
      return { valid: false };
    }
    if (edge.fromTrackId !== previousTrackId || edge.toTrackId !== nextTrackId) {
      return { valid: false };
    }
    return { valid: true, kind: "transition", childComplete: true };
  }
  if (connector.inBlockId) {
    const child = await loadSequenceEndpoints(connector.inBlockId);
    if (!child || child.startTrackId == null || child.endTrackId == null) {
      return { valid: false };
    }
    if (child.startTrackId !== previousTrackId || child.endTrackId !== nextTrackId) {
      return { valid: false };
    }
    return { valid: true, kind: "block", childComplete: child.isComplete };
  }
  return { valid: false };
}

async function nestedBlockIds(sequenceId: string): Promise<string[]> {
  const stepRefs = await getExecutor()
    .select({ inBlockId: blockSteps.inBlockId })
    .from(blockSteps)
    .where(eq(blockSteps.blockId, sequenceId));
  const altRefs = await getExecutor()
    .select({ altBlockId: blockAlternates.altBlockId })
    .from(blockAlternates)
    .where(eq(blockAlternates.blockId, sequenceId));
  const ids = new Set<string>();
  for (const row of stepRefs) {
    if (row.inBlockId) ids.add(row.inBlockId);
  }
  for (const row of altRefs) {
    if (row.altBlockId) ids.add(row.altBlockId);
  }
  return [...ids];
}

async function nestingDepth(sequenceId: string, visiting = new Set<string>()): Promise<number> {
  if (visiting.has(sequenceId)) {
    return SEQUENCE_MAX_NESTING_DEPTH + 1;
  }
  visiting.add(sequenceId);
  const children = await nestedBlockIds(sequenceId);
  if (children.length === 0) {
    visiting.delete(sequenceId);
    return 0;
  }
  let maxChild = 0;
  for (const childId of children) {
    maxChild = Math.max(maxChild, await nestingDepth(childId, visiting));
  }
  visiting.delete(sequenceId);
  return 1 + maxChild;
}

async function assertAcyclicReference(parentId: string, childId: string): Promise<void> {
  if (parentId === childId) {
    throw new MusicWriteError(
      "invalid_input",
      "A sequence cannot use itself as a block connector.",
    );
  }
  const stack = [childId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === parentId) {
      throw new MusicWriteError(
        "invalid_input",
        "Block connectors must be acyclic: this reference would create a cycle.",
      );
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const nested = await nestedBlockIds(id);
    stack.push(...nested);
  }
  const childDepth = await nestingDepth(childId);
  if (childDepth >= SEQUENCE_MAX_NESTING_DEPTH) {
    throw new MusicWriteError(
      "invalid_input",
      `Block connector exceeds the nesting depth cap of ${SEQUENCE_MAX_NESTING_DEPTH}.`,
    );
  }
  const parentDepth = await nestingDepth(parentId);
  if (Math.max(parentDepth, 1 + childDepth) > SEQUENCE_MAX_NESTING_DEPTH) {
    throw new MusicWriteError(
      "invalid_input",
      `Block connector exceeds the nesting depth cap of ${SEQUENCE_MAX_NESTING_DEPTH}.`,
    );
  }
}

async function countConnectorsForPairs(
  pairs: Array<{ fromTrackId: string; toTrackId: string }>,
  excludeSequenceId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const unique = new Map<string, { fromTrackId: string; toTrackId: string }>();
  for (const pair of pairs) {
    unique.set(pairKey(pair.fromTrackId, pair.toTrackId), pair);
  }
  for (const pair of unique.values()) {
    counts.set(pairKey(pair.fromTrackId, pair.toTrackId), 0);
  }
  if (unique.size === 0) {
    return counts;
  }

  const fromIds = [...new Set([...unique.values()].map((p) => p.fromTrackId))];
  const toIds = [...new Set([...unique.values()].map((p) => p.toTrackId))];

  const transitionRows = await getExecutor()
    .select({ fromTrackId: transitions.fromTrackId, toTrackId: transitions.toTrackId })
    .from(transitions)
    .where(and(inArray(transitions.fromTrackId, fromIds), inArray(transitions.toTrackId, toIds)));
  for (const row of transitionRows) {
    const key = pairKey(row.fromTrackId, row.toTrackId);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const blockRows = await getExecutor()
    .select({
      id: blocks.id,
      startTrackId: blocks.startTrackId,
      endTrackId: blocks.endTrackId,
    })
    .from(blocks)
    .where(
      and(
        eq(blocks.kind, "block"),
        eq(blocks.isComplete, true),
        inArray(blocks.startTrackId, fromIds),
        inArray(blocks.endTrackId, toIds),
      ),
    );
  for (const row of blockRows) {
    if (!row.startTrackId || !row.endTrackId || row.id === excludeSequenceId) {
      continue;
    }
    const key = pairKey(row.startTrackId, row.endTrackId);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

async function deriveGapState(
  previous: BlockStepRow,
  step: BlockStepRow,
  candidateCount: number,
): Promise<GapState> {
  if (step.isSeam) {
    return "seam";
  }
  const validity = await validateConnector(previous.trackId, step.trackId, step);
  if (validity.valid) {
    return "linked";
  }
  return candidateCount > 0 ? "available" : "unmapped";
}

async function computeIsComplete(steps: BlockStepRow[]): Promise<boolean> {
  if (steps.length === 0) {
    return false;
  }
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const step = steps[i]!;
    if (step.isSeam) {
      continue;
    }
    const validity = await validateConnector(prev.trackId, step.trackId, step);
    if (!validity.valid) {
      return false;
    }
    if (validity.kind === "block" && !validity.childComplete) {
      return false;
    }
  }
  return true;
}

async function clearStaleStepConnectors(steps: BlockStepRow[]): Promise<BlockStepRow[]> {
  const next = steps.map((step) => ({ ...step }));
  for (let i = 1; i < next.length; i++) {
    const prev = next[i - 1]!;
    const step = next[i]!;
    if (step.isSeam || (!step.inTransitionId && !step.inBlockId)) {
      continue;
    }
    const validity = await validateConnector(prev.trackId, step.trackId, step);
    if (!validity.valid) {
      await getExecutor()
        .update(blockSteps)
        .set({ inTransitionId: null, inBlockId: null, updatedAt: new Date() })
        .where(eq(blockSteps.id, step.id));
      step.inTransitionId = null;
      step.inBlockId = null;
    }
  }
  return next;
}

async function findParentSequenceIds(sequenceId: string): Promise<string[]> {
  const stepParents = await getExecutor()
    .select({ blockId: blockSteps.blockId })
    .from(blockSteps)
    .where(eq(blockSteps.inBlockId, sequenceId));
  const altParents = await getExecutor()
    .select({ blockId: blockAlternates.blockId })
    .from(blockAlternates)
    .where(eq(blockAlternates.altBlockId, sequenceId));
  return [...new Set([...stepParents, ...altParents].map((row) => row.blockId))];
}

/**
 * Rewrite derived caches after a structural change, then walk ancestors.
 * Stale pins are cleared here so stored connectors never outlive a write.
 */
async function recomputeSequenceDerived(
  sequenceId: string,
  visited = new Set<string>(),
): Promise<void> {
  if (visited.has(sequenceId)) {
    return;
  }
  visited.add(sequenceId);

  const steps = await clearStaleStepConnectors(await loadOrderedSteps(sequenceId));
  const startTrackId = steps[0]?.trackId ?? null;
  const endTrackId = steps.length > 0 ? steps[steps.length - 1]!.trackId : null;
  const isComplete = await computeIsComplete(steps);

  await getExecutor()
    .update(blocks)
    .set({
      startTrackId,
      endTrackId,
      isComplete,
      updatedAt: new Date(),
    })
    .where(eq(blocks.id, sequenceId));

  const parents = await findParentSequenceIds(sequenceId);
  for (const parentId of parents) {
    await recomputeSequenceDerived(parentId, visited);
  }
}

async function hydrateSteps(sequenceId: string, steps: BlockStepRow[]): Promise<SequenceStep[]> {
  const pairs: Array<{ fromTrackId: string; toTrackId: string }> = [];
  for (let i = 1; i < steps.length; i++) {
    pairs.push({ fromTrackId: steps[i - 1]!.trackId, toTrackId: steps[i]!.trackId });
  }
  const candidates = await countConnectorsForPairs(pairs, sequenceId);
  const hydrated: SequenceStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const prev = i > 0 ? steps[i - 1] : null;
    const candidateCount = prev ? (candidates.get(pairKey(prev.trackId, step.trackId)) ?? 0) : 0;
    hydrated.push({
      id: step.id,
      position: step.position,
      trackId: step.trackId,
      inTransitionId: step.inTransitionId,
      inBlockId: step.inBlockId,
      isSeam: step.isSeam,
      note: step.note ?? null,
      gapState: prev ? await deriveGapState(prev, step, candidateCount) : null,
      candidateCount,
      createdAt: step.createdAt.toISOString(),
      updatedAt: step.updatedAt.toISOString(),
    });
  }
  return hydrated;
}

async function hydrateAlternates(
  steps: BlockStepRow[],
  rows: BlockAlternateRow[],
): Promise<SequenceAlternate[]> {
  const result: SequenceAlternate[] = [];
  for (const row of rows) {
    result.push({
      id: row.id,
      label: row.label ?? null,
      fromStepId: row.fromStepId,
      toStepId: row.toStepId,
      altTransitionId: row.altTransitionId,
      altBlockId: row.altBlockId,
      valid: await isAlternateValid(steps, row),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }
  return result;
}

async function isAlternateValid(steps: BlockStepRow[], row: BlockAlternateRow): Promise<boolean> {
  const span = spanRange(steps, row.fromStepId, row.toStepId);
  if (!span || span.fromIdx === 0) {
    return false;
  }
  const predecessor = steps[span.fromIdx - 1]!;
  const destination = steps[span.toIdx]!;
  const validity = await validateConnector(predecessor.trackId, destination.trackId, {
    inTransitionId: row.altTransitionId,
    inBlockId: row.altBlockId,
  });
  return validity.valid;
}

async function assertConnectorMatchesGap(
  sequenceId: string,
  previousTrackId: string,
  nextTrackId: string,
  connector: ConnectorRef,
): Promise<void> {
  if (!connector.inTransitionId && !connector.inBlockId) {
    return;
  }
  if (connector.inBlockId) {
    await assertAcyclicReference(sequenceId, connector.inBlockId);
  }
  const validity = await validateConnector(previousTrackId, nextTrackId, connector);
  if (!validity.valid) {
    throw new MusicWriteError(
      "invalid_input",
      "Connector endpoints do not match the neighboring tracks.",
    );
  }
}

async function rewritePositions(sequenceId: string, orderedIds: string[]): Promise<void> {
  const now = new Date();
  for (let i = 0; i < orderedIds.length; i++) {
    await getExecutor()
      .update(blockSteps)
      .set({ position: i, updatedAt: now })
      .where(and(eq(blockSteps.id, orderedIds[i]!), eq(blockSteps.blockId, sequenceId)));
  }
}

async function insertStepRow(
  sequenceId: string,
  input: {
    trackId: string;
    position: number;
    inTransitionId: string | null;
    inBlockId: string | null;
    isSeam: boolean;
    note: string | null;
  },
): Promise<BlockStepRow> {
  const id = randomUUID();
  const [row] = await getExecutor()
    .insert(blockSteps)
    .values({
      id,
      blockId: sequenceId,
      position: input.position,
      trackId: input.trackId,
      inTransitionId: input.inTransitionId,
      inBlockId: input.inBlockId,
      isSeam: input.isSeam,
      note: input.note,
    })
    .returning();
  if (!row) {
    throw new MusicWriteError("invalid_input", "Failed to create sequence step.");
  }
  return row;
}

function resolveInsertIndex(position: number | "append" | undefined, length: number): number {
  if (position === undefined || position === "append") {
    return length;
  }
  if (!Number.isInteger(position) || position < 0 || position > length) {
    throw new MusicWriteError(
      "invalid_input",
      `position must be an integer between 0 and ${length} (inclusive).`,
    );
  }
  return position;
}

async function expandResolvedSteps(
  sequenceId: string,
  steps: BlockStepRow[],
  depth: number,
): Promise<SequenceExpansion> {
  if (depth > SEQUENCE_MAX_NESTING_DEPTH) {
    return { entries: [], truncated: true, reason: "depth_exceeded" };
  }
  const entries: ExpandedSequenceEntry[] = [];
  let truncated = false;
  let reason: SequenceExpansion["reason"] = null;

  const pushStep = (step: BlockStepRow, sourceId: string, stepDepth: number) => {
    entries.push({
      stepId: step.id,
      trackId: step.trackId,
      sequenceId: sourceId,
      depth: stepDepth,
      inTransitionId: step.inTransitionId,
      inBlockId: step.inBlockId,
    });
  };

  if (steps.length === 0) {
    return { entries, truncated, reason };
  }
  pushStep(steps[0]!, sequenceId, depth);

  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const step = steps[i]!;
    if (step.isSeam || !step.inBlockId) {
      pushStep(step, sequenceId, depth);
      continue;
    }
    const validity = await validateConnector(prev.trackId, step.trackId, step);
    if (!validity.valid) {
      pushStep(step, sequenceId, depth);
      truncated = true;
      reason = reason ?? "broken";
      continue;
    }
    if (validity.kind === "block" && !validity.childComplete) {
      pushStep(step, sequenceId, depth);
      truncated = true;
      reason = reason ?? "incomplete";
      continue;
    }
    if (depth + 1 > SEQUENCE_MAX_NESTING_DEPTH) {
      pushStep(step, sequenceId, depth);
      truncated = true;
      reason = reason ?? "depth_exceeded";
      continue;
    }
    const childSteps = await loadOrderedSteps(step.inBlockId);
    const nested = await expandResolvedSteps(step.inBlockId, childSteps, depth + 1);
    // Skip the child's first track — it duplicates the predecessor.
    entries.push(...nested.entries.slice(1));
    if (nested.truncated) {
      truncated = true;
      reason = reason ?? nested.reason;
    }
  }

  return { entries, truncated, reason };
}

function applyVersionToSteps(
  steps: BlockStepRow[],
  alternates: BlockAlternateRow[],
  chosenIds: string[],
): BlockStepRow[] {
  const chosen = alternates.filter((row) => chosenIds.includes(row.id));
  const consumed = new Set<string>();
  const resolved = steps.map((step) => ({ ...step }));
  const ranges = chosen
    .map((alt) => {
      const span = spanRange(steps, alt.fromStepId, alt.toStepId);
      return span ? { alt, span } : null;
    })
    .filter((item): item is { alt: BlockAlternateRow; span: { fromIdx: number; toIdx: number } } =>
      Boolean(item),
    )
    .sort((a, b) => a.span.fromIdx - b.span.fromIdx);

  // Later slices use original indices; apply from the end so earlier ranges stay valid.
  const applied: Array<{ alt: BlockAlternateRow; span: { fromIdx: number; toIdx: number } }> = [];
  for (const item of ranges) {
    const ids = steps.slice(item.span.fromIdx, item.span.toIdx + 1).map((step) => step.id);
    if (ids.some((id) => consumed.has(id))) {
      continue;
    }
    for (const id of ids) consumed.add(id);
    applied.push(item);
  }

  for (const item of applied.reverse()) {
    const host = resolved.find((step) => step.id === item.alt.toStepId);
    if (!host) continue;
    host.inTransitionId = item.alt.altTransitionId;
    host.inBlockId = item.alt.altBlockId;
    host.isSeam = false;
    const fromIdx = resolved.findIndex((step) => step.id === item.alt.fromStepId);
    const toIdx = resolved.findIndex((step) => step.id === item.alt.toStepId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx > toIdx) continue;
    if (fromIdx < toIdx) {
      resolved.splice(fromIdx, toIdx - fromIdx);
    }
  }
  return resolved;
}

async function buildDetail(
  row: BlockRow,
  options: GetSequenceDetailOptions = {},
): Promise<SequenceDetail> {
  const steps = await loadOrderedSteps(row.id);
  const alternateRows = await loadAlternates(row.id);
  const versions = await loadVersions(row.id);
  let expansion: SequenceExpansion | null = null;
  if (options.expand) {
    let resolved = steps;
    if (options.versionId) {
      const version = versions.find((item) => item.id === options.versionId);
      if (!version) {
        throw new MusicWriteError("not_found", `Version "${options.versionId}" was not found.`);
      }
      resolved = applyVersionToSteps(steps, alternateRows, version.alternateIds);
    }
    expansion = await expandResolvedSteps(row.id, resolved, 0);
  }
  return {
    ...toRecord(row),
    startTrackId: steps[0]?.trackId ?? null,
    endTrackId: steps.length > 0 ? steps[steps.length - 1]!.trackId : null,
    isComplete: await computeIsComplete(steps),
    steps: await hydrateSteps(row.id, steps),
    alternates: await hydrateAlternates(steps, alternateRows),
    versions,
    expansion,
  };
}

async function reloadDetail(sequenceId: string): Promise<SequenceDetail> {
  const row = await requireSequenceRow(sequenceId);
  return buildDetail(row);
}

function listWhere(input: {
  kind?: BlockKind;
  query: string;
  complete?: boolean;
  startTrackId?: string;
  endTrackId?: string;
}): SQL | undefined {
  const parts: SQL[] = [];
  if (input.kind) {
    parts.push(eq(blocks.kind, input.kind));
  }
  if (input.query) {
    const pattern = `%${input.query.toLowerCase()}%`;
    parts.push(sql`lower(${blocks.title}) like ${pattern}`);
  }
  if (input.complete === true) {
    parts.push(eq(blocks.isComplete, true));
  } else if (input.complete === false) {
    parts.push(eq(blocks.isComplete, false));
  }
  if (input.startTrackId) {
    parts.push(eq(blocks.startTrackId, input.startTrackId));
  }
  if (input.endTrackId) {
    parts.push(eq(blocks.endTrackId, input.endTrackId));
  }
  if (parts.length === 0) {
    return undefined;
  }
  return parts.length === 1 ? parts[0] : and(...parts);
}

export async function listSequences(input: ListSequencesInput = {}): Promise<ListSequencesResult> {
  const kind = input.kind ? parseKind(input.kind) : undefined;
  const query = input.query?.trim() ?? "";
  const startTrackId = input.startTrackId?.trim() || undefined;
  const endTrackId = input.endTrackId?.trim() || undefined;
  const limit = clampListLimit(input.limit);
  const offset = clampListOffset(input.offset);
  const where = listWhere({
    kind,
    query,
    complete: input.complete,
    startTrackId,
    endTrackId,
  });

  const rows = await getExecutor()
    .select()
    .from(blocks)
    .where(where)
    .orderBy(desc(blocks.updatedAt), asc(blocks.title), asc(blocks.id))
    .limit(limit + 1)
    .offset(offset);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    sequences: page.map(toRecord),
    limit,
    offset,
    hasMore,
  };
}

export async function getSequenceDetail(
  sequenceId: string,
  options: GetSequenceDetailOptions = {},
): Promise<SequenceDetail> {
  const row = await requireSequenceRow(sequenceId);
  return buildDetail(row, options);
}

export async function createSequence(input: CreateSequenceInput): Promise<SequenceDetail> {
  const kind = parseKind(input.kind);
  const title = requireTrimmed(input.title, "title");
  const description = optionalString(input.description);
  const libraryId = optionalString(input.libraryId);
  const seedTrackIds =
    input.seed && "trackIds" in input.seed
      ? input.seed.trackIds
      : input.seed && "trail" in input.seed
        ? input.seed.trail.map((item) => item.trackId)
        : [];
  await requireTrackIds(seedTrackIds);

  return runInDbTransaction(async () => {
    const id = randomUUID();
    const [row] = await getExecutor()
      .insert(blocks)
      .values({ id, kind, title, description, libraryId })
      .returning();
    if (!row) {
      throw new MusicWriteError("invalid_input", "Failed to create sequence.");
    }

    if (input.seed && "trail" in input.seed) {
      for (let i = 0; i < input.seed.trail.length; i++) {
        const item = input.seed.trail[i]!;
        const connector =
          i === 0
            ? { inTransitionId: null, inBlockId: null }
            : xorConnector(item.inTransitionId, null);
        if (i > 0 && connector.inTransitionId) {
          const prev = input.seed.trail[i - 1]!;
          await assertConnectorMatchesGap(id, prev.trackId, item.trackId, connector);
        }
        await insertStepRow(id, {
          trackId: item.trackId,
          position: i,
          inTransitionId: connector.inTransitionId,
          inBlockId: null,
          isSeam: false,
          note: null,
        });
      }
    } else if (seedTrackIds.length > 0) {
      for (let i = 0; i < seedTrackIds.length; i++) {
        await insertStepRow(id, {
          trackId: seedTrackIds[i]!,
          position: i,
          inTransitionId: null,
          inBlockId: null,
          isSeam: false,
          note: null,
        });
      }
    }

    await recomputeSequenceDerived(id);
    return reloadDetail(id);
  });
}

export async function updateSequence(
  sequenceId: string,
  input: UpdateSequenceInput,
): Promise<SequenceDetail> {
  if (input.kind === undefined && input.title === undefined && input.description === undefined) {
    throw new MusicWriteError("invalid_input", "updateSequence requires at least one field.");
  }
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const patch: {
      updatedAt: Date;
      kind?: BlockKind;
      title?: string;
      description?: string | null;
    } = { updatedAt: new Date() };
    if (input.kind !== undefined) {
      patch.kind = parseKind(input.kind);
    }
    if (input.title !== undefined) {
      patch.title = requireTrimmed(input.title, "title");
    }
    if (input.description !== undefined) {
      patch.description = optionalString(input.description);
    }
    const [row] = await getExecutor()
      .update(blocks)
      .set(patch)
      .where(eq(blocks.id, sequenceId))
      .returning();
    if (!row) {
      throw new MusicWriteError("not_found", `Sequence "${sequenceId}" was not found.`);
    }
    return buildDetail(row);
  });
}

export async function listSequenceReferrers(sequenceId: string): Promise<SequenceReferrer[]> {
  const id = requireTrimmed(sequenceId, "sequenceId");
  const stepRefs = await getExecutor()
    .select({
      id: blocks.id,
      title: blocks.title,
      kind: blocks.kind,
    })
    .from(blockSteps)
    .innerJoin(blocks, eq(blockSteps.blockId, blocks.id))
    .where(eq(blockSteps.inBlockId, id));
  const altRefs = await getExecutor()
    .select({
      id: blocks.id,
      title: blocks.title,
      kind: blocks.kind,
    })
    .from(blockAlternates)
    .innerJoin(blocks, eq(blockAlternates.blockId, blocks.id))
    .where(eq(blockAlternates.altBlockId, id));
  const map = new Map<string, SequenceReferrer>();
  for (const row of [...stepRefs, ...altRefs]) {
    map.set(row.id, row);
  }
  return [...map.values()];
}

export async function deleteSequence(sequenceId: string): Promise<{ id: string; deleted: true }> {
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const referrers = await listSequenceReferrers(sequenceId);
    if (referrers.length > 0) {
      const names = referrers.map((row) => `"${row.title}" (${row.id})`).join(", ");
      throw new MusicWriteError(
        "conflict",
        `Sequence is used as a connector by: ${names}. Detach or remove those references first.`,
      );
    }
    const deleted = await getExecutor()
      .delete(blocks)
      .where(eq(blocks.id, sequenceId))
      .returning({ id: blocks.id });
    const deletedId = deleted[0]?.id;
    if (!deletedId) {
      throw new MusicWriteError("not_found", `Sequence "${sequenceId}" was not found.`);
    }
    return { id: deletedId, deleted: true as const };
  });
}

export async function addSequenceStep(
  sequenceId: string,
  input: AddSequenceStepInput,
): Promise<SequenceDetail> {
  const trackId = requireTrimmed(input.trackId, "trackId");
  await requireTrackIds([trackId]);
  const isSeam = input.isSeam === true;
  const connector = xorConnector(input.inTransitionId, input.inBlockId);
  if (isSeam && (connector.inTransitionId || connector.inBlockId)) {
    throw new MusicWriteError("invalid_input", "A seam cannot also have a connector.");
  }
  const note = optionalString(input.note);

  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const steps = await loadOrderedSteps(sequenceId);
    const index = resolveInsertIndex(input.position, steps.length);
    if (index === 0 && (connector.inTransitionId || connector.inBlockId || isSeam)) {
      throw new MusicWriteError("invalid_input", "The first step has no inbound gap.");
    }
    if (index > 0 && (connector.inTransitionId || connector.inBlockId)) {
      const previous = steps[index - 1]!;
      await assertConnectorMatchesGap(sequenceId, previous.trackId, trackId, connector);
    }
    if (index < steps.length) {
      await getExecutor()
        .update(blockSteps)
        .set({ position: sql`${blockSteps.position} + 1`, updatedAt: new Date() })
        .where(and(eq(blockSteps.blockId, sequenceId), gte(blockSteps.position, index)));
    }
    await insertStepRow(sequenceId, {
      trackId,
      position: index,
      inTransitionId: isSeam ? null : connector.inTransitionId,
      inBlockId: isSeam ? null : connector.inBlockId,
      isSeam,
      note,
    });
    await recomputeSequenceDerived(sequenceId);
    return reloadDetail(sequenceId);
  });
}

export async function updateSequenceStep(
  sequenceId: string,
  stepId: string,
  input: UpdateSequenceStepInput,
): Promise<SequenceDetail> {
  if (
    input.trackId === undefined &&
    input.inTransitionId === undefined &&
    input.inBlockId === undefined &&
    input.isSeam === undefined &&
    input.note === undefined
  ) {
    throw new MusicWriteError("invalid_input", "updateSequenceStep requires at least one field.");
  }
  assertExclusiveConnectorPatch(input);
  if (input.trackId !== undefined) {
    await requireTrackIds([requireTrimmed(input.trackId, "trackId")]);
  }

  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const steps = await loadOrderedSteps(sequenceId);
    const index = steps.findIndex((step) => step.id === stepId);
    if (index < 0) {
      throw new MusicWriteError("not_found", `Step "${stepId}" was not found.`);
    }
    const current = steps[index]!;
    const nextTrackId =
      input.trackId !== undefined ? requireTrimmed(input.trackId, "trackId") : current.trackId;
    let inTransitionId = current.inTransitionId;
    let inBlockId = current.inBlockId;
    let isSeam = current.isSeam;
    if (input.isSeam !== undefined) {
      isSeam = input.isSeam;
    }
    if (input.inTransitionId !== undefined) {
      inTransitionId = optionalString(input.inTransitionId);
      if (input.inBlockId === undefined) {
        inBlockId = null;
      }
    }
    if (input.inBlockId !== undefined) {
      inBlockId = optionalString(input.inBlockId);
      if (input.inTransitionId === undefined) {
        inTransitionId = null;
      }
    }
    const connector = xorConnector(inTransitionId, inBlockId);
    if (isSeam && (connector.inTransitionId || connector.inBlockId)) {
      throw new MusicWriteError("invalid_input", "A seam cannot also have a connector.");
    }
    if (index === 0 && (connector.inTransitionId || connector.inBlockId || isSeam)) {
      throw new MusicWriteError("invalid_input", "The first step has no inbound gap.");
    }
    if (index > 0 && (connector.inTransitionId || connector.inBlockId) && !isSeam) {
      const previous = steps[index - 1]!;
      await assertConnectorMatchesGap(sequenceId, previous.trackId, nextTrackId, connector);
    }
    await getExecutor()
      .update(blockSteps)
      .set({
        trackId: nextTrackId,
        inTransitionId: isSeam ? null : connector.inTransitionId,
        inBlockId: isSeam ? null : connector.inBlockId,
        isSeam,
        note: input.note !== undefined ? optionalString(input.note) : current.note,
        updatedAt: new Date(),
      })
      .where(and(eq(blockSteps.id, stepId), eq(blockSteps.blockId, sequenceId)));
    await recomputeSequenceDerived(sequenceId);
    return reloadDetail(sequenceId);
  });
}

export async function deleteSequenceStep(
  sequenceId: string,
  stepId: string,
): Promise<SequenceDetail> {
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const deleted = await getExecutor()
      .delete(blockSteps)
      .where(and(eq(blockSteps.id, stepId), eq(blockSteps.blockId, sequenceId)))
      .returning({ id: blockSteps.id });
    if (!deleted[0]) {
      throw new MusicWriteError("not_found", `Step "${stepId}" was not found.`);
    }
    const remaining = await loadOrderedSteps(sequenceId);
    await rewritePositions(
      sequenceId,
      remaining.map((step) => step.id),
    );
    await recomputeSequenceDerived(sequenceId);
    return reloadDetail(sequenceId);
  });
}

export async function reorderSequence(
  sequenceId: string,
  stepIds: string[],
): Promise<SequenceDetail> {
  if (!Array.isArray(stepIds)) {
    throw new MusicWriteError("invalid_input", "stepIds must be an array of step ids.");
  }
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const steps = await loadOrderedSteps(sequenceId);
    const current = new Set(steps.map((step) => step.id));
    const incoming = new Set(stepIds);
    if (current.size !== incoming.size || stepIds.some((id) => !current.has(id))) {
      throw new MusicWriteError(
        "invalid_input",
        "stepIds must be the complete set of this sequence's step ids.",
      );
    }
    if (new Set(stepIds).size !== stepIds.length) {
      throw new MusicWriteError("invalid_input", "stepIds must not contain duplicates.");
    }
    await rewritePositions(sequenceId, stepIds);
    await recomputeSequenceDerived(sequenceId);
    return reloadDetail(sequenceId);
  });
}

export async function detachSequenceStep(
  sequenceId: string,
  stepId: string,
): Promise<SequenceDetail> {
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const steps = await loadOrderedSteps(sequenceId);
    const index = steps.findIndex((step) => step.id === stepId);
    if (index < 0) {
      throw new MusicWriteError("not_found", `Step "${stepId}" was not found.`);
    }
    const host = steps[index]!;
    if (!host.inBlockId) {
      throw new MusicWriteError("invalid_input", "Step does not have a block connector to detach.");
    }
    const childSteps = await loadOrderedSteps(host.inBlockId);
    if (childSteps.length < 2) {
      await getExecutor()
        .update(blockSteps)
        .set({ inBlockId: null, inTransitionId: null, updatedAt: new Date() })
        .where(eq(blockSteps.id, host.id));
      await recomputeSequenceDerived(sequenceId);
      return reloadDetail(sequenceId);
    }
    const interior = childSteps.slice(1, -1);
    const last = childSteps[childSteps.length - 1]!;
    const lastConnector = xorConnector(last.inTransitionId, last.inBlockId);
    if (lastConnector.inBlockId) {
      await assertAcyclicReference(sequenceId, lastConnector.inBlockId);
    }
    const insertedIds: string[] = [];
    for (const inner of interior) {
      const innerConnector = xorConnector(inner.inTransitionId, inner.inBlockId);
      if (innerConnector.inBlockId) {
        await assertAcyclicReference(sequenceId, innerConnector.inBlockId);
      }
      const inserted = await insertStepRow(sequenceId, {
        trackId: inner.trackId,
        position: host.position,
        inTransitionId: innerConnector.inTransitionId,
        inBlockId: innerConnector.inBlockId,
        isSeam: inner.isSeam,
        note: inner.note ?? null,
      });
      insertedIds.push(inserted.id);
    }
    await getExecutor()
      .update(blockSteps)
      .set({
        inTransitionId: lastConnector.inTransitionId,
        inBlockId: lastConnector.inBlockId,
        isSeam: last.isSeam,
        updatedAt: new Date(),
      })
      .where(eq(blockSteps.id, host.id));
    const orderedIds = [
      ...steps.slice(0, index).map((step) => step.id),
      ...insertedIds,
      host.id,
      ...steps.slice(index + 1).map((step) => step.id),
    ];
    await rewritePositions(sequenceId, orderedIds);
    await recomputeSequenceDerived(sequenceId);
    return reloadDetail(sequenceId);
  });
}

async function assertAlternateSpan(
  sequenceId: string,
  steps: BlockStepRow[],
  fromStepId: string,
  toStepId: string,
  connector: ConnectorRef,
): Promise<void> {
  const span = spanRange(steps, fromStepId, toStepId);
  if (!span) {
    throw new MusicWriteError(
      "invalid_input",
      "fromStepId and toStepId must bound a contiguous span of this sequence.",
    );
  }
  if (span.fromIdx === 0) {
    throw new MusicWriteError(
      "invalid_input",
      "An alternate cannot start at the first step — there is no predecessor track.",
    );
  }
  const predecessor = steps[span.fromIdx - 1]!;
  const destination = steps[span.toIdx]!;
  if (!connector.inTransitionId && !connector.inBlockId) {
    throw new MusicWriteError(
      "invalid_input",
      "An alternate requires exactly one of altTransitionId or altBlockId.",
    );
  }
  await assertConnectorMatchesGap(sequenceId, predecessor.trackId, destination.trackId, connector);
}

export async function createSequenceAlternate(
  sequenceId: string,
  input: CreateSequenceAlternateInput,
): Promise<SequenceDetail> {
  const fromStepId = requireTrimmed(input.fromStepId, "fromStepId");
  const toStepId = requireTrimmed(input.toStepId, "toStepId");
  const connector = xorConnector(input.altTransitionId, input.altBlockId);
  const label = optionalString(input.label);

  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const steps = await loadOrderedSteps(sequenceId);
    await assertAlternateSpan(sequenceId, steps, fromStepId, toStepId, connector);
    const [row] = await getExecutor()
      .insert(blockAlternates)
      .values({
        id: randomUUID(),
        blockId: sequenceId,
        label,
        fromStepId,
        toStepId,
        altTransitionId: connector.inTransitionId,
        altBlockId: connector.inBlockId,
      })
      .returning();
    if (!row) {
      throw new MusicWriteError("invalid_input", "Failed to create alternate.");
    }
    return reloadDetail(sequenceId);
  });
}

export async function updateSequenceAlternate(
  sequenceId: string,
  alternateId: string,
  input: UpdateSequenceAlternateInput,
): Promise<SequenceDetail> {
  if (
    input.fromStepId === undefined &&
    input.toStepId === undefined &&
    input.label === undefined &&
    input.altTransitionId === undefined &&
    input.altBlockId === undefined
  ) {
    throw new MusicWriteError(
      "invalid_input",
      "updateSequenceAlternate requires at least one field.",
    );
  }

  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const [current] = await getExecutor()
      .select()
      .from(blockAlternates)
      .where(and(eq(blockAlternates.id, alternateId), eq(blockAlternates.blockId, sequenceId)))
      .limit(1);
    if (!current) {
      throw new MusicWriteError("not_found", `Alternate "${alternateId}" was not found.`);
    }
    const fromStepId =
      input.fromStepId !== undefined
        ? requireTrimmed(input.fromStepId, "fromStepId")
        : current.fromStepId;
    const toStepId =
      input.toStepId !== undefined ? requireTrimmed(input.toStepId, "toStepId") : current.toStepId;
    let altTransitionId = current.altTransitionId;
    let altBlockId = current.altBlockId;
    if (input.altTransitionId !== undefined) {
      altTransitionId = optionalString(input.altTransitionId);
      if (input.altBlockId === undefined) {
        altBlockId = null;
      }
    }
    if (input.altBlockId !== undefined) {
      altBlockId = optionalString(input.altBlockId);
      if (input.altTransitionId === undefined) {
        altTransitionId = null;
      }
    }
    const connector = xorConnector(altTransitionId, altBlockId);
    const steps = await loadOrderedSteps(sequenceId);
    await assertAlternateSpan(sequenceId, steps, fromStepId, toStepId, connector);
    await getExecutor()
      .update(blockAlternates)
      .set({
        fromStepId,
        toStepId,
        label: input.label !== undefined ? optionalString(input.label) : current.label,
        altTransitionId: connector.inTransitionId,
        altBlockId: connector.inBlockId,
        updatedAt: new Date(),
      })
      .where(eq(blockAlternates.id, alternateId));
    return reloadDetail(sequenceId);
  });
}

export async function deleteSequenceAlternate(
  sequenceId: string,
  alternateId: string,
): Promise<SequenceDetail> {
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const deleted = await getExecutor()
      .delete(blockAlternates)
      .where(and(eq(blockAlternates.id, alternateId), eq(blockAlternates.blockId, sequenceId)))
      .returning({ id: blockAlternates.id });
    if (!deleted[0]) {
      throw new MusicWriteError("not_found", `Alternate "${alternateId}" was not found.`);
    }
    return reloadDetail(sequenceId);
  });
}

function assertNoOverlappingChoices(steps: BlockStepRow[], chosen: BlockAlternateRow[]): void {
  const ranges: Array<{ fromIdx: number; toIdx: number }> = [];
  for (const alt of chosen) {
    const span = spanRange(steps, alt.fromStepId, alt.toStepId);
    if (!span) {
      throw new MusicWriteError(
        "invalid_input",
        `Alternate "${alt.id}" does not bound a contiguous span.`,
      );
    }
    for (const existing of ranges) {
      if (alternateSpansOverlap(existing, span)) {
        throw new MusicWriteError(
          "invalid_input",
          "Chosen alternates in a version must not overlap the same step.",
        );
      }
    }
    ranges.push(span);
  }
}

async function replaceVersionChoices(versionId: string, alternateIds: string[]): Promise<void> {
  await getExecutor()
    .delete(blockVersionChoices)
    .where(eq(blockVersionChoices.versionId, versionId));
  if (alternateIds.length === 0) {
    return;
  }
  await getExecutor()
    .insert(blockVersionChoices)
    .values(alternateIds.map((alternateId) => ({ versionId, alternateId })));
}

async function loadChosenAlternates(
  sequenceId: string,
  alternateIds: string[],
): Promise<BlockAlternateRow[]> {
  if (alternateIds.length === 0) {
    return [];
  }
  const unique = [...new Set(alternateIds.map((id) => requireTrimmed(id, "alternateId")))];
  const rows = await getExecutor()
    .select()
    .from(blockAlternates)
    .where(and(eq(blockAlternates.blockId, sequenceId), inArray(blockAlternates.id, unique)));
  if (rows.length !== unique.length) {
    throw new MusicWriteError("invalid_input", "Every alternateId must belong to this sequence.");
  }
  return rows;
}

export async function createSequenceVersion(
  sequenceId: string,
  input: CreateSequenceVersionInput,
): Promise<SequenceDetail> {
  const name = requireTrimmed(input.name, "name");
  const alternateIds = input.alternateIds ?? [];
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const steps = await loadOrderedSteps(sequenceId);
    const chosen = await loadChosenAlternates(sequenceId, alternateIds);
    assertNoOverlappingChoices(steps, chosen);
    const [row] = await getExecutor()
      .insert(blockVersions)
      .values({ id: randomUUID(), blockId: sequenceId, name })
      .returning();
    if (!row) {
      throw new MusicWriteError("invalid_input", "Failed to create version.");
    }
    await replaceVersionChoices(
      row.id,
      chosen.map((alt) => alt.id),
    );
    return reloadDetail(sequenceId);
  });
}

export async function updateSequenceVersion(
  sequenceId: string,
  versionId: string,
  input: UpdateSequenceVersionInput,
): Promise<SequenceDetail> {
  if (input.name === undefined && input.alternateIds === undefined) {
    throw new MusicWriteError(
      "invalid_input",
      "updateSequenceVersion requires at least one field.",
    );
  }
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const [current] = await getExecutor()
      .select()
      .from(blockVersions)
      .where(and(eq(blockVersions.id, versionId), eq(blockVersions.blockId, sequenceId)))
      .limit(1);
    if (!current) {
      throw new MusicWriteError("not_found", `Version "${versionId}" was not found.`);
    }
    if (input.alternateIds !== undefined) {
      const steps = await loadOrderedSteps(sequenceId);
      const chosen = await loadChosenAlternates(sequenceId, input.alternateIds);
      assertNoOverlappingChoices(steps, chosen);
      await replaceVersionChoices(
        versionId,
        chosen.map((alt) => alt.id),
      );
    }
    await getExecutor()
      .update(blockVersions)
      .set({
        name: input.name !== undefined ? requireTrimmed(input.name, "name") : current.name,
        updatedAt: new Date(),
      })
      .where(eq(blockVersions.id, versionId));
    return reloadDetail(sequenceId);
  });
}

export async function deleteSequenceVersion(
  sequenceId: string,
  versionId: string,
): Promise<SequenceDetail> {
  return runInDbTransaction(async () => {
    await requireSequenceRow(sequenceId);
    const deleted = await getExecutor()
      .delete(blockVersions)
      .where(and(eq(blockVersions.id, versionId), eq(blockVersions.blockId, sequenceId)))
      .returning({ id: blockVersions.id });
    if (!deleted[0]) {
      throw new MusicWriteError("not_found", `Version "${versionId}" was not found.`);
    }
    return reloadDetail(sequenceId);
  });
}
