"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@selecta/ui/components/toast";

import { describeApiError } from "@/lib/api/errors";
import {
  alternateFirstHop,
  classifyHop,
  insertPositionOnOwner,
  pinsForIndex,
  playPathFromExpansion,
  skipSpanForOffscript,
  snapBackIndex,
  upcomingTitles,
  type GraphSetPin,
  type UpcomingAlternate,
} from "@/lib/graph/set-mode";
import {
  clearGraphSetCursor,
  getGraphSessionSnapshot,
  setGraphSetCursor,
  useGraphSession,
} from "@/lib/graph/session-store";
import type { ApiNeighborhoodNeighbor } from "@/lib/graph/types";
import { canAuthorAlternates, alternatesForGap } from "@/lib/sequences/alternates";
import {
  addSequenceStep,
  createSequenceAlternate,
  getSequence,
  updateSequenceStep,
} from "@/lib/sequences/api";
import type { AlternateDraft, SequenceDetail } from "@/lib/sequences/types";
import { sequenceWorkspaceHref } from "@/lib/sequences/view";

export type OffScriptPrompt = {
  destinationTrackId: string;
  destinationTitle: string;
  transitionId: string | null;
  fromStepId: string;
  ownerSequenceId: string;
  plannedSequenceId: string | null;
  plannedTitle: string | null;
  plannedStepId: string | null;
  stepNumber: number;
};

export type GraphSetMode = {
  active: boolean;
  title: string;
  kind: "set" | "block" | null;
  workspaceHref: string | null;
  index: number;
  total: number;
  upcomingTitles: string[];
  pins: GraphSetPin[];
  seamMarker: { nextTitle: string } | null;
  loadError: string | null;
  offScript: OffScriptPrompt | null;
  offScriptError: string | null;
  offScriptPending: boolean;
  canSaveAlternate: boolean;
  nestedConfirm: { title: string } | null;
  alternateDraft: AlternateDraft | null;
  handleHop: (fromId: string, toId: string, transitionId: string | null) => void;
  saveAlternate: () => void;
  confirmAlternate: (label: string) => Promise<void>;
  cancelAlternate: () => void;
  insertHere: () => void;
  replacePlanned: () => void;
  keepExploring: () => void;
  confirmNested: () => void;
  cancelNested: () => void;
  dismissOffScript: () => void;
};

export function useGraphSetMode(neighbors: ApiNeighborhoodNeighbor[]): GraphSetMode {
  const session = useGraphSession();
  const { toast } = useToast();
  const [root, setRoot] = useState<SequenceDetail | null>(null);
  const [byId, setById] = useState<Record<string, SequenceDetail>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offScript, setOffScript] = useState<OffScriptPrompt | null>(null);
  const [offScriptError, setOffScriptError] = useState<string | null>(null);
  const [offScriptPending, setOffScriptPending] = useState(false);
  const [nestedConfirm, setNestedConfirm] = useState<{
    title: string;
    action: "insert" | "replace" | "alternate";
  } | null>(null);
  const [alternateDraft, setAlternateDraft] = useState<AlternateDraft | null>(null);

  const sequenceId = session.sequenceId;
  const versionId = session.versionId;

  const reload = useCallback(async () => {
    if (!sequenceId) return null;
    const result = await getSequence(sequenceId, { expand: true, versionId });
    setRoot(result.sequence);
    return result.sequence;
  }, [sequenceId, versionId]);

  useEffect(() => {
    if (!sequenceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getSequence(sequenceId, { expand: true, versionId });
        if (cancelled) return;
        setRoot(result.sequence);
        setLoadError(null);
        const entries = result.sequence.expansion?.entries ?? [];
        const snapshot = getGraphSessionSnapshot();
        if (snapshot.stepId && !entries.some((entry) => entry.stepId === snapshot.stepId)) {
          const match = snapshot.activeId
            ? entries.find((entry) => entry.trackId === snapshot.activeId)
            : null;
          if (match) setGraphSetCursor({ stepId: match.stepId, alternateId: null });
        }
        const nestedIds = [
          ...new Set(
            (result.sequence.expansion?.entries ?? [])
              .map((entry) => entry.sequenceId)
              .filter((id) => id !== result.sequence.id),
          ),
        ];
        const loaded: Record<string, SequenceDetail> = {};
        await Promise.all(
          nestedIds.map(async (id) => {
            const nested = await getSequence(id);
            loaded[id] = nested.sequence;
          }),
        );
        const altBlockIds = [result.sequence, ...Object.values(loaded)].flatMap((detail) =>
          detail.alternates
            .map((item) => item.altBlockId)
            .filter((id): id is string => Boolean(id)),
        );
        await Promise.all(
          altBlockIds.map(async (id) => {
            if (id === result.sequence.id || loaded[id]) return;
            const nested = await getSequence(id);
            loaded[id] = nested.sequence;
          }),
        );
        if (cancelled) return;
        setById(loaded);
      } catch (err) {
        if (!cancelled) {
          setLoadError(describeApiError(err, { fallback: "Failed to load set." }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sequenceId, versionId]);

  const path = useMemo(
    () => (root?.expansion ? playPathFromExpansion(root.expansion.entries) : []),
    [root],
  );

  const index = useMemo(() => {
    if (!session.stepId || path.length === 0) return 0;
    const exact = path.findIndex((entry) => entry.stepId === session.stepId);
    return exact < 0 ? 0 : exact;
  }, [path, session.stepId]);

  const ownerById = useCallback(
    (id: string | undefined | null): SequenceDetail | null => {
      if (!id || !root) return null;
      if (root.id === id) return root;
      return byId[id] ?? null;
    },
    [root, byId],
  );

  const upcomingAlts: UpcomingAlternate[] = useMemo(() => {
    const upcoming = path[index + 1];
    if (!upcoming) return [];
    const owner = ownerById(upcoming.sequenceId);
    if (!owner || !canAuthorAlternates(owner.kind)) return [];
    return alternatesForGap(owner.alternates, upcoming.stepId).map((item) => {
      const hop = alternateFirstHop(
        item,
        owner.steps,
        item.altBlockId ? (byId[item.altBlockId]?.steps ?? null) : null,
      );
      return {
        id: item.id,
        label: item.label,
        valid: item.valid && hop != null,
        firstTrackId: hop?.trackId ?? null,
        firstStepId: hop?.stepId ?? null,
        title: hop?.title ?? "Untitled",
        artists: hop?.artists ?? [],
        artworkUrl: hop?.artworkUrl ?? null,
      };
    });
  }, [path, index, ownerById, byId]);

  const pins = useMemo(
    () =>
      pinsForIndex({
        path,
        index,
        currentTrackId: session.activeId,
        upcomingAlts,
      }),
    [path, index, session.activeId, upcomingAlts],
  );

  const upcoming = path[index + 1];
  const seamMarker = upcoming?.isSeam ? { nextTitle: upcoming.title } : null;

  const handleHop = useCallback(
    (fromId: string, toId: string, transitionId: string | null) => {
      if (!sequenceId || path.length === 0) return;
      const dests = upcomingAlts
        .filter((item) => item.valid && item.firstTrackId)
        .map((item) => item.firstTrackId!);
      const kind = classifyHop({
        path,
        index,
        destinationTrackId: toId,
        upcomingAlternateDestinations: dests,
      });
      if (kind === "on-script") {
        const next = path[index + 1];
        if (next) setGraphSetCursor({ stepId: next.stepId, alternateId: null });
        return;
      }
      if (kind === "alternate") {
        const alt = upcomingAlts.find((item) => item.firstTrackId === toId);
        if (alt?.firstStepId) {
          setGraphSetCursor({ stepId: alt.firstStepId, alternateId: alt.id });
        }
        return;
      }
      if (kind === "seam") {
        const snap = snapBackIndex(path, index, toId);
        if (snap != null) {
          setGraphSetCursor({ stepId: path[snap]!.stepId, alternateId: null });
        }
        return;
      }
      const current = path[index];
      const next = path[index + 1];
      const neighbor = neighbors.find((item) => item.id === toId);
      setOffScriptError(null);
      setOffScript({
        destinationTrackId: toId,
        destinationTitle: neighbor?.title ?? "this track",
        transitionId,
        fromStepId: current?.stepId ?? session.stepId ?? "",
        ownerSequenceId: current?.sequenceId ?? sequenceId,
        plannedSequenceId: next?.sequenceId ?? null,
        plannedTitle: next?.title ?? null,
        plannedStepId: next?.stepId ?? null,
        stepNumber: next ? index + 2 : index + 1,
      });
    },
    [sequenceId, path, index, upcomingAlts, neighbors, session.stepId],
  );

  const ownerForPrompt = offScript
    ? ownerById(offScript.plannedSequenceId ?? offScript.ownerSequenceId)
    : null;
  const canSaveAlternate = Boolean(
    offScript?.transitionId && ownerForPrompt && canAuthorAlternates(ownerForPrompt.kind),
  );

  function needsNestedConfirm(ownerId: string): boolean {
    return Boolean(sequenceId && ownerId !== sequenceId);
  }

  async function runInsert(prompt: OffScriptPrompt) {
    const owner = ownerById(prompt.ownerSequenceId);
    if (!owner) throw new Error("Sequence not found.");
    const position = insertPositionOnOwner(owner.steps, prompt.fromStepId);
    if (position == null) throw new Error("Could not find the current step.");
    const result = await addSequenceStep(owner.id, {
      trackId: prompt.destinationTrackId,
      position,
      inTransitionId: prompt.transitionId,
    });
    const inserted = result.sequence.steps[position];
    await reload();
    if (inserted) setGraphSetCursor({ stepId: inserted.id, alternateId: null });
    setOffScript(null);
    if (versionId) toast("Saved to the base path");
  }

  async function runReplace(prompt: OffScriptPrompt) {
    if (!prompt.plannedStepId || !prompt.plannedSequenceId) return;
    const owner = ownerById(prompt.plannedSequenceId);
    if (!owner) throw new Error("Sequence not found.");
    await updateSequenceStep(owner.id, prompt.plannedStepId, {
      trackId: prompt.destinationTrackId,
      inTransitionId: prompt.transitionId,
    });
    await reload();
    setGraphSetCursor({ stepId: prompt.plannedStepId, alternateId: null });
    setOffScript(null);
    if (versionId) toast("Saved to the base path");
  }

  async function runSaveAlternate(prompt: OffScriptPrompt, label: string) {
    const owner = ownerById(prompt.plannedSequenceId ?? prompt.ownerSequenceId);
    if (!owner || !prompt.plannedStepId || !prompt.transitionId) {
      throw new Error("This hop cannot be saved as an alternate.");
    }
    const span = skipSpanForOffscript(owner.steps, prompt.plannedStepId, prompt.destinationTrackId);
    if (!span) {
      setOffScriptError(
        `"${prompt.destinationTitle}" is not on this ${owner.kind}, so it can't be an alternate yet. Insert it, or rejoin a planned track first.`,
      );
      setAlternateDraft(null);
      return;
    }
    await createSequenceAlternate(owner.id, {
      fromStepId: span.fromStepId,
      toStepId: span.toStepId,
      label,
      altTransitionId: prompt.transitionId,
    });
    await reload();
    setAlternateDraft(null);
    setOffScript(null);
    toast("Saved as an alternate — the primary line is unchanged");
    if (versionId) toast("Saved to the base path");
  }

  async function withPending(action: () => Promise<void>) {
    setOffScriptPending(true);
    setOffScriptError(null);
    try {
      await action();
    } catch (err) {
      setOffScriptError(describeApiError(err, { fallback: "Could not update the set." }));
    } finally {
      setOffScriptPending(false);
    }
  }

  function insertHere() {
    if (!offScript) return;
    if (needsNestedConfirm(offScript.ownerSequenceId)) {
      const owner = ownerById(offScript.ownerSequenceId);
      setNestedConfirm({ title: owner?.title ?? "this block", action: "insert" });
      return;
    }
    void withPending(() => runInsert(offScript));
  }

  function replacePlanned() {
    if (!offScript?.plannedStepId || !offScript.plannedSequenceId) return;
    if (needsNestedConfirm(offScript.plannedSequenceId)) {
      const owner = ownerById(offScript.plannedSequenceId);
      setNestedConfirm({ title: owner?.title ?? "this block", action: "replace" });
      return;
    }
    void withPending(() => runReplace(offScript));
  }

  function openAlternateDraft(prompt: OffScriptPrompt) {
    const owner = ownerById(prompt.plannedSequenceId ?? prompt.ownerSequenceId);
    if (!owner || !prompt.plannedStepId || !prompt.transitionId) {
      setOffScriptError(
        `"${prompt.destinationTitle}" is not on this ${owner?.kind ?? "set"}, so it can't be an alternate yet. Insert it, or rejoin a planned track first.`,
      );
      return;
    }
    const span = skipSpanForOffscript(owner.steps, prompt.plannedStepId, prompt.destinationTrackId);
    if (!span) {
      setOffScriptError(
        `"${prompt.destinationTitle}" is not on this ${owner.kind}, so it can't be an alternate yet. Insert it, or rejoin a planned track first.`,
      );
      return;
    }
    setAlternateDraft({
      fromStepId: span.fromStepId,
      toStepId: span.toStepId,
      altTransitionId: prompt.transitionId,
      summary: `${prompt.destinationTitle} as plan B`,
    });
  }

  function saveAlternate() {
    if (!offScript?.transitionId || !canSaveAlternate) return;
    const editId = offScript.plannedSequenceId ?? offScript.ownerSequenceId;
    if (needsNestedConfirm(editId)) {
      const owner = ownerById(editId);
      setNestedConfirm({ title: owner?.title ?? "this block", action: "alternate" });
      return;
    }
    openAlternateDraft(offScript);
  }

  function confirmNested() {
    if (!offScript || !nestedConfirm) return;
    const action = nestedConfirm.action;
    setNestedConfirm(null);
    if (action === "insert") void withPending(() => runInsert(offScript));
    if (action === "replace") void withPending(() => runReplace(offScript));
    if (action === "alternate") openAlternateDraft(offScript);
  }

  const currentPos = path[index];
  const visibleOffScript =
    offScript && !(currentPos && currentPos.trackId === session.activeId) ? offScript : null;

  const inactive: GraphSetMode = {
    active: false,
    title: "",
    kind: null,
    workspaceHref: null,
    index: 0,
    total: 0,
    upcomingTitles: [],
    pins: [],
    seamMarker: null,
    loadError: null,
    offScript: null,
    offScriptError: null,
    offScriptPending: false,
    canSaveAlternate: false,
    nestedConfirm: null,
    alternateDraft: null,
    handleHop,
    saveAlternate: () => undefined,
    confirmAlternate: async () => undefined,
    cancelAlternate: () => undefined,
    insertHere: () => undefined,
    replacePlanned: () => undefined,
    keepExploring: () => undefined,
    confirmNested: () => undefined,
    cancelNested: () => undefined,
    dismissOffScript: () => undefined,
  };

  if (!sequenceId) return { ...inactive, handleHop };

  return {
    active: true,
    title: root?.title ?? "Set",
    kind: root?.kind ?? null,
    workspaceHref: root ? sequenceWorkspaceHref(root.kind, root.id) : null,
    index,
    total: path.length,
    upcomingTitles: upcomingTitles(path, index),
    pins,
    seamMarker,
    loadError,
    offScript: visibleOffScript,
    offScriptError,
    offScriptPending,
    canSaveAlternate,
    nestedConfirm: nestedConfirm ? { title: nestedConfirm.title } : null,
    alternateDraft,
    handleHop,
    saveAlternate,
    confirmAlternate: async (label: string) => {
      if (!offScript) return;
      await withPending(() => runSaveAlternate(offScript, label));
    },
    cancelAlternate: () => setAlternateDraft(null),
    insertHere,
    replacePlanned,
    keepExploring: () => {
      setOffScript(null);
      setOffScriptError(null);
      setAlternateDraft(null);
      setNestedConfirm(null);
      clearGraphSetCursor();
    },
    confirmNested,
    cancelNested: () => setNestedConfirm(null),
    dismissOffScript: () => {
      setOffScript(null);
      setOffScriptError(null);
    },
  };
}
