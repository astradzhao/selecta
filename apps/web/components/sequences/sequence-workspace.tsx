"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DragEvent } from "react";
import { XIcon } from "lucide-react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { ConfirmDialog } from "@selecta/ui/components/confirm-dialog";
import { StatePanel } from "@selecta/ui/components/state-panel";
import { useToast } from "@selecta/ui/components/toast";

import { BackLink } from "@/components/common/back-link";
import { ApiClientError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/errors";
import {
  addSequenceStep,
  createSequenceAlternate,
  deleteSequence,
  deleteSequenceAlternate,
  deleteSequenceStep,
  detachSequenceStep,
  getSequence,
  listSequenceReferrers,
  listSequences,
  reorderSequence,
  updateSequence,
  updateSequenceAlternate,
  updateSequenceStep,
} from "@/lib/sequences/api";
import {
  alternateCoverage,
  formatAlternateCoverage,
  orderSpan,
  spanRange,
  versionCountUsingAlternate,
} from "@/lib/sequences/alternates";
import {
  autoLinkTransitionId,
  blockFitPayload,
  dropFit,
  insertIndex,
  numericInsertIndex,
  paletteBlockReason,
  paletteTransitionReason,
  spanFitFromSelection,
  type FitPayload,
} from "@/lib/sequences/drag";
import { incompleteBlockCount } from "@/lib/sequences/gap-display";
import {
  formatApproxRuntime,
  formatPlannedLine,
  plannedMetrics,
  sequenceRuntimeSec,
  sequenceTrackCount,
} from "@/lib/sequences/metrics";
import { moveUnit, reorderTo, unitRange } from "@/lib/sequences/reorder";
import type {
  AlternateDraft,
  DropTarget,
  SequenceAlternate,
  SequenceDetail,
  SequenceKind,
  SequenceRecord,
  SequenceReferrer,
  SequenceStep,
  WorkspaceSelection,
} from "@/lib/sequences/types";
import { sequenceWorkspaceHref, setsViewHref } from "@/lib/sequences/view";
import { listTransitions } from "@/lib/transitions/api";
import type { ApiTransition } from "@/lib/transitions/types";
import { displayVocab } from "@/lib/transitions/vocab-labels";
import type { ApiTrack } from "@/lib/tracks/api";

import { AlternateLabelDialog } from "./alternate-label-dialog";
import { LibraryPalette, type PaletteTab } from "./library-palette";
import { SequenceRunningOrder } from "./sequence-running-order";

function findOwnedStep(
  parent: SequenceDetail,
  children: Record<string, SequenceDetail>,
  stepId: string,
): { sequenceId: string; step: SequenceStep } | null {
  const parentStep = parent.steps.find((item) => item.id === stepId);
  if (parentStep) return { sequenceId: parent.id, step: parentStep };
  for (const [id, child] of Object.entries(children)) {
    const inner = child.steps.find((item) => item.id === stepId);
    if (inner) return { sequenceId: id, step: inner };
  }
  return null;
}

export function SequenceWorkspace({
  sequenceId,
  routeKind,
}: {
  sequenceId: string;
  routeKind: SequenceKind;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [detail, setDetail] = useState<SequenceDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [selection, setSelection] = useState<WorkspaceSelection>({ kind: "none" });
  const [paletteTab, setPaletteTab] = useState<PaletteTab>("tracks");
  const [pickerStepId, setPickerStepId] = useState<string | null>(null);
  const [pickerIntent, setPickerIntent] = useState<"link" | "alternate">("link");
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [dragPayload, setDragPayload] = useState<FitPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedBlockIds, setExpandedBlockIds] = useState<Record<string, boolean>>({});
  const [childById, setChildById] = useState<Record<string, SequenceDetail>>({});
  const [childErrorById, setChildErrorById] = useState<Record<string, string>>({});
  const [referrers, setReferrers] = useState<SequenceReferrer[]>([]);
  const [pendingRemove, setPendingRemove] = useState<{
    stepIds: string[];
    title: string;
  } | null>(null);
  const [pendingDetach, setPendingDetach] = useState<{
    stepId: string;
    blockId: string;
    title: string;
  } | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{
    blockId: string;
    title: string;
    description: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [spanCandidateTotal, setSpanCandidateTotal] = useState<number | null>(null);
  const [expandedAlternateIds, setExpandedAlternateIds] = useState<Record<string, boolean>>({});
  const [alternateDraft, setAlternateDraft] = useState<AlternateDraft | null>(null);
  const [alternatePending, setAlternatePending] = useState(false);
  const [alternateError, setAlternateError] = useState<string | null>(null);
  const [pendingAlternateRemove, setPendingAlternateRemove] = useState<{
    item: SequenceAlternate;
    versionCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getSequence(sequenceId);
        if (cancelled) return;
        setDetail(result.sequence);
        setTitleDraft(result.sequence.title);
        setLoadError(null);
      } catch (err) {
        if (!cancelled) {
          setLoadError(describeApiError(err, { resource: "sequence" }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sequenceId]);

  useEffect(() => {
    if (!detail) return;
    if (detail.kind !== routeKind) {
      router.replace(sequenceWorkspaceHref(detail.kind, detail.id));
    }
  }, [detail, routeKind, router]);

  useEffect(() => {
    if (routeKind !== "block") {
      setReferrers([]);
      return;
    }
    let cancelled = false;
    void listSequenceReferrers(sequenceId)
      .then((result) => {
        if (!cancelled) setReferrers(result.referrers);
      })
      .catch(() => {
        if (!cancelled) setReferrers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [routeKind, sequenceId]);

  useEffect(() => {
    if (!detail || selection.kind !== "span") {
      setSpanCandidateTotal(null);
      return;
    }
    const range = spanRange(detail.steps, selection.fromStepId, selection.toStepId);
    if (!range) {
      setSpanCandidateTotal(0);
      return;
    }
    let cancelled = false;
    void Promise.all([
      listTransitions({
        fromTrackId: range.predecessor.trackId,
        toTrackId: range.destination.trackId,
        limit: 50,
      }),
      listSequences({
        kind: "block",
        startTrack: range.predecessor.trackId,
        endTrack: range.destination.trackId,
        complete: true,
        limit: 50,
      }),
    ])
      .then(([transitionResult, blockResult]) => {
        if (cancelled) return;
        const blocks = blockResult.sequences.filter(
          (row) => row.id !== detail.id && row.isComplete,
        );
        setSpanCandidateTotal(transitionResult.transitions.length + blocks.length);
      })
      .catch(() => {
        if (!cancelled) setSpanCandidateTotal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [detail, selection]);

  useEffect(() => {
    if (selection.kind !== "span" || alternateDraft) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSelection({ kind: "none" });
      setPickerStepId(null);
      setPickerIntent("link");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection.kind, alternateDraft]);

  function applyDetail(next: SequenceDetail) {
    setDetail(next);
    setTitleDraft(next.title);
    setSelection((current) => {
      if (current.kind === "none") return current;
      if (current.kind === "span") {
        return spanRange(next.steps, current.fromStepId, current.toStepId)
          ? current
          : { kind: "none" };
      }
      const step = next.steps.find((item) => item.id === current.stepId);
      if (step) {
        if (current.kind === "gap" && step.gapState == null) return { kind: "none" };
        return current;
      }
      if (
        current.kind === "step" &&
        Object.values(childById).some((child) =>
          child.steps.some((item) => item.id === current.stepId),
        )
      ) {
        return current;
      }
      return { kind: "none" };
    });
    setPickerStepId((current) => {
      if (!current) return null;
      const step = next.steps.find((item) => item.id === current);
      return step && step.gapState != null ? current : null;
    });
  }

  async function mutate(
    writer: () => Promise<{ sequence: SequenceDetail }>,
    message?: string,
  ): Promise<SequenceDetail | null> {
    try {
      const result = await writer();
      applyDetail(result.sequence);
      if (message) toast(message);
      setConflict(null);
      return result.sequence;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const fresh = await getSequence(sequenceId);
        applyDetail(fresh.sequence);
        setConflict("Sequence was updated elsewhere. Reloaded the latest version.");
        return fresh.sequence;
      }
      toast(describeApiError(err));
      return null;
    }
  }

  async function mutateChild(
    blockId: string,
    writer: () => Promise<{ sequence: SequenceDetail }>,
    message?: string,
  ): Promise<SequenceDetail | null> {
    try {
      const result = await writer();
      setChildById((current) => ({ ...current, [blockId]: result.sequence }));
      if (message) toast(message);
      setConflict(null);
      return result.sequence;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const fresh = await getSequence(blockId);
        setChildById((current) => ({ ...current, [blockId]: fresh.sequence }));
        setConflict("Sequence was updated elsewhere. Reloaded the latest version.");
        return fresh.sequence;
      }
      toast(describeApiError(err));
      return null;
    }
  }

  function clearTransient() {
    setSelection({ kind: "none" });
    setPickerStepId(null);
    setPickerIntent("link");
  }

  function forgetChild(blockId: string) {
    setExpandedBlockIds((current) => {
      const next = { ...current };
      delete next[blockId];
      return next;
    });
    setChildById((current) => {
      const next = { ...current };
      delete next[blockId];
      return next;
    });
    setChildErrorById((current) => {
      const next = { ...current };
      delete next[blockId];
      return next;
    });
  }

  async function addTrackAt(
    trackId: string,
    title: string,
    position: number | "append",
    ownerId?: string,
  ) {
    if (!detail) return;
    const targetId = ownerId ?? detail.id;
    const steps = targetId === detail.id ? detail.steps : (childById[targetId]?.steps ?? null);
    if (!steps) return;
    const numeric = position === "append" ? steps.length : position;
    const prev = steps[numeric - 1];
    let inTransitionId: string | undefined;
    let linkedTechnique: string | null = null;
    if (prev) {
      const candidates = await listTransitions({
        fromTrackId: prev.trackId,
        toTrackId: trackId,
        limit: 5,
      });
      const autoId = autoLinkTransitionId(candidates.transitions);
      if (autoId) {
        inTransitionId = autoId;
        const hit = candidates.transitions.find((item) => item.id === autoId);
        linkedTechnique = displayVocab(hit?.technique) ?? "mix";
      }
    }
    const where =
      numeric === steps.length ? `Appended ${title}` : `Inserted ${title} at ${numeric + 1}`;
    const message = inTransitionId ? `${where} · linked ${linkedTechnique}` : where;
    const writer = () =>
      addSequenceStep(targetId, {
        trackId,
        position,
        ...(inTransitionId ? { inTransitionId } : {}),
      });
    if (targetId === detail.id) await mutate(writer, message);
    else await mutateChild(targetId, writer, message);
    clearTransient();
  }

  async function handleAddTrack(track: ApiTrack) {
    if (!detail) return;
    if (selection.kind === "span") {
      toast("Select a step or gap to insert a track");
      return;
    }
    if (selection.kind === "step") {
      const owned = findOwnedStep(detail, childById, selection.stepId);
      if (owned && owned.sequenceId !== detail.id) {
        const child = childById[owned.sequenceId];
        const index = child?.steps.findIndex((item) => item.id === owned.step.id) ?? -1;
        if (index < 0) return;
        await addTrackAt(track.id, track.title, index + 1, owned.sequenceId);
        return;
      }
    }
    await addTrackAt(track.id, track.title, insertIndex(selection, detail.steps));
  }

  function beginAlternateDraft(draft: AlternateDraft) {
    setAlternateError(null);
    setAlternateDraft(draft);
  }

  async function handleAddTransition(transition: ApiTransition) {
    if (!detail) return;
    const technique = displayVocab(transition.technique) ?? "mix";
    if (selection.kind === "span") {
      const reason = paletteTransitionReason(
        {
          kind: "transition",
          id: transition.id,
          fromTrackId: transition.fromTrack.id,
          toTrackId: transition.toTrack.id,
          fromTitle: transition.fromTrack.title,
          toTitle: transition.toTrack.title,
          technique,
        },
        selection,
        detail.steps,
      );
      if (reason) {
        toast(reason);
        return;
      }
      beginAlternateDraft({
        fromStepId: selection.fromStepId,
        toStepId: selection.toStepId,
        altTransitionId: transition.id,
        summary: `${technique} · ${transition.fromTrack.title} → ${transition.toTrack.title}`,
      });
      return;
    }
    if (selection.kind === "gap") {
      await mutate(
        () =>
          updateSequenceStep(detail.id, selection.stepId, {
            inTransitionId: transition.id,
            isSeam: false,
          }),
        `Linked ${technique}`,
      );
      clearTransient();
      return;
    }
    if (selection.kind === "step") {
      const owned = findOwnedStep(detail, childById, selection.stepId);
      if (owned && owned.sequenceId !== detail.id) {
        const child = childById[owned.sequenceId];
        const index = child?.steps.findIndex((item) => item.id === owned.step.id) ?? -1;
        if (index < 0) return;
        await mutateChild(
          owned.sequenceId,
          () =>
            addSequenceStep(owned.sequenceId, {
              trackId: transition.toTrack.id,
              position: index + 1,
              inTransitionId: transition.id,
            }),
          `${technique} → ${transition.toTrack.title} added`,
        );
        clearTransient();
        return;
      }
    }
    if (detail.steps.length === 0) {
      await mutate(async () => {
        const first = await addSequenceStep(detail.id, { trackId: transition.fromTrack.id });
        return addSequenceStep(first.sequence.id, {
          trackId: transition.toTrack.id,
          inTransitionId: transition.id,
        });
      }, `${technique} → ${transition.toTrack.title} added`);
      return;
    }
    await mutate(
      () =>
        addSequenceStep(detail.id, {
          trackId: transition.toTrack.id,
          position: insertIndex(selection, detail.steps),
          inTransitionId: transition.id,
        }),
      `${technique} → ${transition.toTrack.title} added`,
    );
    clearTransient();
  }

  async function insertBlockAt(
    payload: Extract<FitPayload, { kind: "block" }>,
    target: DropTarget,
  ) {
    if (!detail || !payload.startTrackId || !payload.endTrackId) return;
    if (target.kind === "gap") {
      const dest = detail.steps[target.index];
      if (!dest) return;
      await mutate(
        () =>
          updateSequenceStep(detail.id, dest.id, {
            inBlockId: payload.id,
            isSeam: false,
          }),
        `Linked ${payload.title}`,
      );
      clearTransient();
      return;
    }
    const position = target.index;
    const prev = detail.steps[position - 1];
    const needAnchor = !prev || prev.trackId !== payload.startTrackId;
    let latest = detail;
    if (needAnchor) {
      const first = await mutate(() =>
        addSequenceStep(detail.id, {
          trackId: payload.startTrackId!,
          position,
        }),
      );
      if (!first) return;
      latest = first;
    }
    const hostPosition = needAnchor ? position + 1 : position;
    await mutate(
      () =>
        addSequenceStep(latest.id, {
          trackId: payload.endTrackId!,
          position: hostPosition,
          inBlockId: payload.id,
        }),
      `Inserted ${payload.title} as a block`,
    );
    clearTransient();
  }

  async function handleAddBlock(block: SequenceRecord) {
    if (!detail) return;
    if (selection.kind === "span") {
      const reason = paletteBlockReason(blockFitPayload(block), selection, detail.steps);
      if (reason) {
        toast(reason);
        return;
      }
      beginAlternateDraft({
        fromStepId: selection.fromStepId,
        toStepId: selection.toStepId,
        altBlockId: block.id,
        summary: block.title,
      });
      return;
    }
    const payload = blockFitPayload(block);
    const insertAt = numericInsertIndex(selection, detail.steps);
    const target: DropTarget =
      selection.kind === "gap"
        ? { kind: "gap", index: insertAt }
        : { kind: "end", index: insertAt };
    const reason = paletteBlockReason(payload, selection, detail.steps);
    if (reason) {
      toast(reason);
      return;
    }
    await insertBlockAt(payload, target);
  }

  async function handlePaletteDrop(target: DropTarget) {
    if (!detail || !dragPayload) return;
    if (selection.kind === "span") {
      if (dragPayload.kind === "track") return;
      const span = spanFitFromSelection(selection, detail.steps);
      if (!span) return;
      if (
        !dropFit(
          dragPayload,
          target,
          detail.steps,
          dragPayload.kind === "transition" ? dragPayload : null,
          span,
        )
      ) {
        return;
      }
      if (dragPayload.kind === "transition") {
        beginAlternateDraft({
          fromStepId: selection.fromStepId,
          toStepId: selection.toStepId,
          altTransitionId: dragPayload.id,
          summary: `${dragPayload.technique} · ${dragPayload.fromTitle} → ${dragPayload.toTitle}`,
        });
        return;
      }
      beginAlternateDraft({
        fromStepId: selection.fromStepId,
        toStepId: selection.toStepId,
        altBlockId: dragPayload.id,
        summary: dragPayload.title,
      });
      return;
    }
    const edge = dragPayload.kind === "transition" ? dragPayload : null;
    if (!dropFit(dragPayload, target, detail.steps, edge)) return;
    if (dragPayload.kind === "track") {
      await addTrackAt(dragPayload.id, dragPayload.title, target.index);
      return;
    }
    if (dragPayload.kind === "block") {
      await insertBlockAt(dragPayload, target);
      return;
    }
    const technique = dragPayload.technique;
    if (target.kind === "gap") {
      const dest = detail.steps[target.index];
      if (!dest) return;
      await mutate(
        () =>
          updateSequenceStep(detail.id, dest.id, {
            inTransitionId: dragPayload.id,
            isSeam: false,
          }),
        `Linked ${technique}`,
      );
      clearTransient();
      return;
    }
    if (detail.steps.length === 0) {
      await mutate(async () => {
        const first = await addSequenceStep(detail.id, { trackId: dragPayload.fromTrackId });
        return addSequenceStep(first.sequence.id, {
          trackId: dragPayload.toTrackId,
          inTransitionId: dragPayload.id,
        });
      }, `${technique} → ${dragPayload.toTitle} added`);
      return;
    }
    await mutate(
      () =>
        addSequenceStep(detail.id, {
          trackId: dragPayload.toTrackId,
          position: target.index,
          inTransitionId: dragPayload.id,
        }),
      `${technique} → ${dragPayload.toTitle} added`,
    );
    clearTransient();
  }

  async function handleReorderIds(stepIds: string[], message: string) {
    if (!detail) return;
    await mutate(
      () =>
        reorderSequence(detail.id, {
          stepIds,
          expectedUpdatedAt: detail.updatedAt,
        }),
      message,
    );
  }

  async function handleMove(stepId: string, delta: -1 | 1) {
    if (!detail) return;
    const index = detail.steps.findIndex((step) => step.id === stepId);
    const next = moveUnit(detail.steps, index, delta);
    if (next.every((step, i) => step.id === detail.steps[i]?.id)) return;
    await handleReorderIds(
      next.map((step) => step.id),
      "Reordered — affected gaps re-derived",
    );
  }

  async function handleReorderDrop(targetStepId: string) {
    if (!detail || !draggingStepId || draggingStepId === targetStepId) return;
    const fromIndex = detail.steps.findIndex((step) => step.id === draggingStepId);
    const targetIndex = detail.steps.findIndex((step) => step.id === targetStepId);
    const next = reorderTo(detail.steps, fromIndex, targetIndex);
    if (next.every((step, i) => step.id === detail.steps[i]?.id)) return;
    await handleReorderIds(
      next.map((step) => step.id),
      "Reordered — affected gaps re-derived",
    );
  }

  async function commitTitle() {
    if (!detail) return;
    const title = titleDraft.trim();
    if (!title || title === detail.title) {
      setTitleDraft(detail.title);
      return;
    }
    await mutate(
      () => updateSequence(detail.id, { title, expectedUpdatedAt: detail.updatedAt }),
      "Renamed",
    );
  }

  async function commitNote(stepId: string) {
    if (!detail) return;
    const owned = findOwnedStep(detail, childById, stepId);
    if (!owned) return;
    const next = (noteDrafts[stepId] ?? owned.step.note ?? "").trim() || null;
    const current = owned.step.note?.trim() || null;
    if (next === current) return;
    if (owned.sequenceId === detail.id) {
      await mutate(() => updateSequenceStep(detail.id, stepId, { note: next }));
      return;
    }
    try {
      const result = await updateSequenceStep(owned.sequenceId, stepId, { note: next });
      setChildById((currentChildren) => ({
        ...currentChildren,
        [owned.sequenceId]: result.sequence,
      }));
      setConflict(null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const fresh = await getSequence(owned.sequenceId);
        setChildById((currentChildren) => ({
          ...currentChildren,
          [owned.sequenceId]: fresh.sequence,
        }));
        setConflict("Sequence was updated elsewhere. Reloaded the latest version.");
        return;
      }
      toast(describeApiError(err));
    }
  }

  async function handleToggleExpand(blockId: string) {
    const opening = !expandedBlockIds[blockId];
    setExpandedBlockIds((current) => ({ ...current, [blockId]: opening }));
    if (!opening || childById[blockId] || childErrorById[blockId]) return;
    try {
      const result = await getSequence(blockId);
      setChildById((current) => ({ ...current, [blockId]: result.sequence }));
    } catch (err) {
      setChildErrorById((current) => ({
        ...current,
        [blockId]: describeApiError(err, { resource: "block" }),
      }));
    }
  }

  async function handleEditBlock(step: SequenceStep) {
    const blockId = step.inBlockId;
    if (!blockId) return;
    const title = step.inBlock?.title ?? "block";
    try {
      const result = await listSequenceReferrers(blockId);
      const count = result.referrers.length;
      if (count === 0) {
        router.push(sequenceWorkspaceHref("block", blockId));
        return;
      }
      setPendingEdit({
        blockId,
        title,
        description: `Edits to “${title}” apply everywhere it is used (${count} ${count === 1 ? "sequence" : "sequences"}).`,
      });
    } catch {
      setPendingEdit({
        blockId,
        title,
        description: `Could not check where “${title}” is used. Edits apply everywhere it is used.`,
      });
    }
  }

  async function handleAddAlternate(stepId: string) {
    if (!detail) return;
    const keepSpan = selection.kind === "span" && selection.fromStepId === stepId;
    const fromStepId = keepSpan ? selection.fromStepId : stepId;
    const toStepId = keepSpan ? selection.toStepId : stepId;
    const range = spanRange(detail.steps, fromStepId, toStepId);
    if (!range) {
      toast("An alternate needs a join to substitute — pick from the second track on.");
      return;
    }
    setSelection({ kind: "span", fromStepId, toStepId });
    setPaletteTab("transitions");
    try {
      const [transitionResult, blockResult] = await Promise.all([
        listTransitions({
          fromTrackId: range.predecessor.trackId,
          toTrackId: range.destination.trackId,
          limit: 50,
        }),
        listSequences({
          kind: "block",
          startTrack: range.predecessor.trackId,
          endTrack: range.destination.trackId,
          complete: true,
          limit: 50,
        }),
      ]);
      const blocks = blockResult.sequences.filter((row) => row.id !== detail.id && row.isComplete);
      const total = transitionResult.transitions.length + blocks.length;
      setSpanCandidateTotal(total);
      if (total > 0) {
        setPickerIntent("alternate");
        setPickerStepId(fromStepId);
      } else {
        setPickerIntent("link");
        setPickerStepId(null);
      }
    } catch {
      setPickerIntent("alternate");
      setPickerStepId(fromStepId);
    }
  }

  function handleSelectStep(stepId: string, shiftKey = false) {
    if (!detail) return;
    if (shiftKey) {
      const anchorId =
        selection.kind === "span"
          ? selection.fromStepId
          : selection.kind === "gap" || selection.kind === "step"
            ? selection.stepId
            : null;
      if (!anchorId) {
        setSelection({ kind: "step", stepId });
        return;
      }
      const ordered = orderSpan(detail.steps, anchorId, stepId);
      if (!ordered) {
        toast("An alternate needs a join to substitute — pick from the second track on.");
        return;
      }
      setSelection({ kind: "span", ...ordered });
      setPaletteTab("transitions");
      setPickerStepId(null);
      setPickerIntent("link");
      return;
    }
    const selected = selection.kind === "step" && selection.stepId === stepId;
    setSelection(selected ? { kind: "none" } : { kind: "step", stepId });
    setPickerStepId(null);
    setPickerIntent("link");
  }

  async function confirmAlternate(label: string) {
    if (!detail || !alternateDraft) return;
    setAlternatePending(true);
    setAlternateError(null);
    const result = await mutate(
      () =>
        createSequenceAlternate(detail.id, {
          fromStepId: alternateDraft.fromStepId,
          toStepId: alternateDraft.toStepId,
          label,
          altTransitionId: alternateDraft.altTransitionId,
          altBlockId: alternateDraft.altBlockId,
        }),
      `Alternate added — ${label}`,
    );
    setAlternatePending(false);
    if (result) {
      setAlternateDraft(null);
      setPickerStepId(null);
      setPickerIntent("link");
    } else {
      setAlternateError("Could not add that alternate.");
    }
  }

  function handleRemoveAlternate(item: SequenceAlternate) {
    if (!detail) return;
    const versionCount = versionCountUsingAlternate(detail.versions, item.id);
    if (versionCount > 0) {
      setPendingAlternateRemove({ item, versionCount });
      return;
    }
    void mutate(() => deleteSequenceAlternate(detail.id, item.id), "Alternate removed");
  }

  function handleToggleAlternateExpand(item: SequenceAlternate) {
    const opening = !expandedAlternateIds[item.id];
    setExpandedAlternateIds((current) => ({ ...current, [item.id]: opening }));
    if (opening && item.altBlockId) {
      void handleToggleExpand(item.altBlockId);
    }
  }

  function handleRemoveStep(step: SequenceStep) {
    if (!detail) return;
    const index = detail.steps.findIndex((item) => item.id === step.id);
    const [start, end] = unitRange(detail.steps, index);
    if (start === end) {
      void mutate(() => deleteSequenceStep(detail.id, step.id), "Step removed");
      return;
    }
    const host = detail.steps[end]!;
    setPendingRemove({
      stepIds: detail.steps.slice(start, end + 1).map((item) => item.id),
      title: host.inBlock?.title ?? "block",
    });
  }

  if (loadError) {
    return <StatePanel variant="error" title="Sequence unavailable" description={loadError} />;
  }
  if (!detail) {
    return <StatePanel variant="loading" title="Loading sequence" />;
  }

  const isBlockKind = detail.kind === "block";
  const metrics = plannedMetrics(detail.steps);
  const runtimeSec = sequenceRuntimeSec(detail.steps);
  const trackCount = sequenceTrackCount(detail.steps);
  const incompleteBlocks = incompleteBlockCount(detail.steps);
  const coverage = formatAlternateCoverage(alternateCoverage(detail.alternates));
  const browseHref = setsViewHref(isBlockKind ? "blocks" : "sets");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <BackLink href={browseHref}>{isBlockKind ? "Blocks" : "Sets"}</BackLink>
      <div className="border-border flex items-start justify-between gap-6 border-b pb-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <input
            aria-label="Sequence title"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={() => void commitTitle()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
            }}
            className="text-page-title max-w-xl rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 outline-none hover:border-border focus-visible:border-ring focus-visible:bg-surface-1 focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <div className="text-muted-foreground flex flex-wrap items-center gap-2.5 text-sm">
            {detail.steps.length === 0 ? (
              <span className="text-numeric">0 tracks</span>
            ) : (
              <>
                <span className="text-numeric">{formatApproxRuntime(runtimeSec)}</span>
                <span aria-hidden>·</span>
                <span>
                  {trackCount} {trackCount === 1 ? "track" : "tracks"}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{formatPlannedLine(metrics, detail.steps.length)}</span>
            {metrics.seams > 0 ? (
              <Badge variant="tertiary">
                {metrics.seams} {metrics.seams === 1 ? "seam" : "seams"}
              </Badge>
            ) : null}
            {incompleteBlocks > 0 ? (
              <Badge variant="warning">{incompleteBlocks} block incomplete</Badge>
            ) : null}
            {coverage ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-numeric">{coverage}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Delete"
            aria-label="Delete sequence"
            onClick={() => setPendingDelete(true)}
          >
            <XIcon />
          </Button>
        </div>
      </div>
      {conflict ? <Alert variant="warning">{conflict}</Alert> : null}
      {isBlockKind && referrers.length > 0 ? (
        <Alert variant="warning">
          Used as a connector in {referrers.length}{" "}
          {referrers.length === 1 ? "sequence" : "sequences"}. Edits apply everywhere this block is
          used.
        </Alert>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
        <SequenceRunningOrder
          sequenceId={detail.id}
          kindNounEmpty={isBlockKind ? "This block has no tracks yet" : "This night is empty"}
          steps={detail.steps}
          selection={selection}
          pickerStepId={pickerStepId}
          notesOpenFor={(step) =>
            step.id in notesOpen ? Boolean(notesOpen[step.id]) : Boolean(step.note?.trim())
          }
          noteValue={(step) => noteDrafts[step.id] ?? step.note ?? ""}
          dragPayload={dragPayload}
          dropTarget={dropTarget}
          draggingStepId={draggingStepId}
          expandedBlockIds={expandedBlockIds}
          childById={childById}
          childErrorById={childErrorById}
          onSelectGap={(stepId) => {
            const selected = selection.kind === "gap" && selection.stepId === stepId;
            setSelection(selected ? { kind: "none" } : { kind: "gap", stepId });
            setPaletteTab(selected ? "tracks" : "transitions");
            setPickerStepId(null);
            setPickerIntent("link");
          }}
          onSelectStep={handleSelectStep}
          onTogglePicker={(stepId) => {
            if (pickerStepId === stepId) {
              setPickerStepId(null);
              return;
            }
            setPickerIntent("link");
            setPickerStepId(stepId);
            setSelection({ kind: "gap", stepId });
            setPaletteTab("transitions");
          }}
          onPickTransition={(stepId, transition) => {
            if (pickerIntent === "alternate" && selection.kind === "span") {
              const technique = displayVocab(transition.technique) ?? "mix";
              beginAlternateDraft({
                fromStepId: selection.fromStepId,
                toStepId: selection.toStepId,
                altTransitionId: transition.id,
                summary: `${technique} · ${transition.fromTrack.title} → ${transition.toTrack.title}`,
              });
              setPickerStepId(null);
              return;
            }
            void mutate(
              () =>
                updateSequenceStep(detail.id, stepId, {
                  inTransitionId: transition.id,
                  isSeam: false,
                }),
              `Linked ${displayVocab(transition.technique) ?? "mix"}`,
            );
            setPickerStepId(null);
            setPickerIntent("link");
            setSelection({ kind: "none" });
          }}
          onPickBlock={(stepId, block) => {
            if (pickerIntent === "alternate" && selection.kind === "span") {
              beginAlternateDraft({
                fromStepId: selection.fromStepId,
                toStepId: selection.toStepId,
                altBlockId: block.id,
                summary: block.title,
              });
              setPickerStepId(null);
              return;
            }
            void mutate(
              () =>
                updateSequenceStep(detail.id, stepId, {
                  inBlockId: block.id,
                  isSeam: false,
                }),
              `Linked ${block.title}`,
            );
            setPickerStepId(null);
            setPickerIntent("link");
            setSelection({ kind: "none" });
          }}
          onUnlink={(stepId) => {
            const step = detail.steps.find((item) => item.id === stepId);
            void mutate(
              () =>
                updateSequenceStep(
                  detail.id,
                  stepId,
                  step?.inBlockId ? { inBlockId: null } : { inTransitionId: null },
                ),
              step?.inBlockId
                ? "Unlinked — the block stays in your library"
                : "Unlinked — the transition stays in your library",
            );
          }}
          onToggleSeam={(step) => {
            void mutate(
              () => updateSequenceStep(detail.id, step.id, { isSeam: !step.isSeam }),
              step.isSeam
                ? "Seam removed — this join counts again"
                : "Marked a seam — excluded from completeness",
            );
          }}
          onToggleExpand={(blockId) => void handleToggleExpand(blockId)}
          onEditBlock={(step) => void handleEditBlock(step)}
          onDetach={(step) => {
            if (!step.inBlockId) return;
            setPendingDetach({
              stepId: step.id,
              blockId: step.inBlockId,
              title: step.inBlock?.title ?? "block",
            });
          }}
          onMove={(stepId, delta) => void handleMove(stepId, delta)}
          onToggleNote={(stepId) => {
            setNotesOpen((current) => {
              const owned = findOwnedStep(detail, childById, stepId);
              const open =
                stepId in current ? Boolean(current[stepId]) : Boolean(owned?.step.note?.trim());
              return { ...current, [stepId]: !open };
            });
          }}
          onNoteChange={(stepId, value) => {
            setNoteDrafts((current) => ({ ...current, [stepId]: value }));
          }}
          onNoteCommit={(stepId) => void commitNote(stepId)}
          onRemove={handleRemoveStep}
          onStepDragStart={(event: DragEvent, step: SequenceStep) => {
            event.dataTransfer.setData("text/plain", step.id);
            event.dataTransfer.effectAllowed = "move";
            setDraggingStepId(step.id);
            setDragPayload(null);
          }}
          onPaletteDrop={(target) => void handlePaletteDrop(target)}
          onReorderDrop={(targetStepId) => void handleReorderDrop(targetStepId)}
          onDragEnd={() => {
            setDragPayload(null);
            setDropTarget(null);
            setDraggingStepId(null);
          }}
          onSetDropTarget={setDropTarget}
          onAddTrackCta={() => {
            setPaletteTab("tracks");
            setSelection({ kind: "none" });
            setPickerIntent("link");
            setPickerStepId(null);
          }}
          onInsertBlockCta={() => {
            setPaletteTab("blocks");
            setSelection({ kind: "none" });
            setPickerIntent("link");
            setPickerStepId(null);
          }}
          alternates={detail.alternates}
          spanCandidateTotal={spanCandidateTotal}
          expandedAlternateIds={expandedAlternateIds}
          onAddAlternate={(stepId) => void handleAddAlternate(stepId)}
          onToggleAlternateExpand={handleToggleAlternateExpand}
          onRemoveAlternate={handleRemoveAlternate}
          onCommitAlternateLabel={(item, label) => {
            void mutate(
              () => updateSequenceAlternate(detail.id, item.id, { label }),
              "Label updated",
            );
          }}
        />
        <LibraryPalette
          sequenceId={detail.id}
          selection={selection}
          steps={detail.steps}
          nestedSteps={Object.values(childById).flatMap((child) => child.steps)}
          tab={paletteTab}
          onTab={setPaletteTab}
          onAddTrack={(track) => void handleAddTrack(track)}
          onAddTransition={(transition) => void handleAddTransition(transition)}
          onAddBlock={(block) => void handleAddBlock(block)}
          onClearSelection={() => {
            setSelection({ kind: "none" });
            setPickerStepId(null);
            setPickerIntent("link");
            setPaletteTab("tracks");
          }}
          onDragStart={setDragPayload}
          onDragEnd={() => {
            setDragPayload(null);
            setDropTarget(null);
          }}
        />
      </div>
      <ConfirmDialog
        open={pendingDelete}
        onOpenChange={setPendingDelete}
        title={`Delete “${detail.title}”?`}
        description="The tracks and transitions stay in your library — only this sequence and its ordering go away. This cannot be undone."
        confirmLabel="Delete"
        pending={deleting}
        pendingLabel="Deleting…"
        onConfirm={() => {
          void (async () => {
            setDeleting(true);
            try {
              await deleteSequence(detail.id);
              toast(`Deleted “${detail.title}”`);
              router.push(browseHref);
            } catch (err) {
              toast(describeApiError(err, { fallback: "Could not delete the sequence." }));
              setDeleting(false);
            }
          })();
        }}
      />
      <ConfirmDialog
        open={pendingRemove != null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title={pendingRemove ? `Remove “${pendingRemove.title}”?` : "Remove block?"}
        description="The block stays in your library — only this night loses the unit."
        confirmLabel="Remove"
        variant="default"
        pending={pendingAction}
        pendingLabel="Removing…"
        onConfirm={() => {
          if (!pendingRemove) return;
          const { stepIds } = pendingRemove;
          setPendingAction(true);
          void (async () => {
            const result = await mutate(async () => {
              let latest = detail;
              for (const id of [...stepIds].reverse()) {
                const next = await deleteSequenceStep(latest.id, id);
                latest = next.sequence;
              }
              return { sequence: latest };
            }, "Block removed — it stays in your library");
            setPendingAction(false);
            if (result) setPendingRemove(null);
          })();
        }}
      />
      <ConfirmDialog
        open={pendingDetach != null}
        onOpenChange={(open) => {
          if (!open) setPendingDetach(null);
        }}
        title={pendingDetach ? `Detach “${pendingDetach.title}”?` : "Detach block?"}
        description="Inline these tracks as editable steps. The original block stays in your library."
        confirmLabel="Detach"
        variant="default"
        pending={pendingAction}
        pendingLabel="Detaching…"
        onConfirm={() => {
          if (!pendingDetach) return;
          const { stepId, blockId } = pendingDetach;
          setPendingAction(true);
          void (async () => {
            const result = await mutate(
              () => detachSequenceStep(detail.id, stepId),
              "Detached to a copy — these steps are editable now",
            );
            setPendingAction(false);
            if (result) {
              forgetChild(blockId);
              setPendingDetach(null);
            }
          })();
        }}
      />
      <ConfirmDialog
        open={pendingEdit != null}
        onOpenChange={(open) => {
          if (!open) setPendingEdit(null);
        }}
        title={pendingEdit ? `Edit “${pendingEdit.title}”?` : "Edit block?"}
        description={pendingEdit?.description ?? ""}
        confirmLabel="Open block"
        variant="default"
        onConfirm={() => {
          if (!pendingEdit) return;
          router.push(sequenceWorkspaceHref("block", pendingEdit.blockId));
        }}
      />
      <AlternateLabelDialog
        draft={alternateDraft}
        pending={alternatePending}
        error={alternateError}
        onOpenChange={(open) => {
          if (!open && !alternatePending) {
            setAlternateDraft(null);
            setAlternateError(null);
          }
        }}
        onConfirm={(label) => void confirmAlternate(label)}
      />
      <ConfirmDialog
        open={pendingAlternateRemove != null}
        onOpenChange={(open) => {
          if (!open) setPendingAlternateRemove(null);
        }}
        title="Remove this alternate?"
        description={
          pendingAlternateRemove
            ? `This alternate is used in ${pendingAlternateRemove.versionCount} saved ${pendingAlternateRemove.versionCount === 1 ? "version" : "versions"}. Removing it drops it from those versions.`
            : ""
        }
        confirmLabel="Remove"
        variant="default"
        pending={pendingAction}
        pendingLabel="Removing…"
        onConfirm={() => {
          if (!pendingAlternateRemove) return;
          const { item } = pendingAlternateRemove;
          setPendingAction(true);
          void (async () => {
            const result = await mutate(
              () => deleteSequenceAlternate(detail.id, item.id),
              "Alternate removed",
            );
            setPendingAction(false);
            if (result) setPendingAlternateRemove(null);
          })();
        }}
      />
    </div>
  );
}
