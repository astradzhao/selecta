"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";

import { omitFieldError } from "@/components/common/form-field";
import { BarChart } from "@/components/graph/bar-chart";
import { edgeKey, formatGraphLabel, provenanceLabel } from "@/components/graph/helpers";
import { QualityMeter } from "@/components/graph/quality-meter";
import {
  emptyTransitionFields,
  parseTransitionFieldPatch,
  TransitionFields,
  transitionFieldsFromEdge,
  type TransitionFieldErrors,
  type TransitionFieldValues,
} from "@/components/tracks/transition-fields";
import { describeApiError } from "@/lib/api/errors";
import type { ApiNeighborhoodNeighbor, ApiTransitionEdge } from "@/lib/graph/types";
import { deleteTransition, updateTransition } from "@/lib/transitions/api";

export function NeighborDetail({
  neighbor,
  selected,
  selectedKey,
  onSelectKey,
  onChoose,
  onNeighborhoodChange,
  choosing,
}: {
  neighbor: ApiNeighborhoodNeighbor;
  selected: ApiTransitionEdge | null;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  onChoose: () => void;
  onNeighborhoodChange: () => Promise<void>;
  choosing: boolean;
}) {
  const edges = neighbor.transitions;
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");
  const [form, setForm] = useState<TransitionFieldValues>(emptyTransitionFields());
  const [fieldErrors, setFieldErrors] = useState<TransitionFieldErrors>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  const t = selected;
  const technique = t ? formatGraphLabel(t.technique) : null;
  const intent = t ? formatGraphLabel(t.intent) : null;
  const provenance = t ? provenanceLabel(t) : null;

  function openEdit() {
    if (!t) return;
    setForm(transitionFieldsFromEdge(t));
    setFieldErrors({});
    setActionError(null);
    setPanelMode("edit");
  }

  function onSaveEdit() {
    if (!t?.id) {
      setActionError("This transition has no stable id yet.");
      return;
    }
    const parsed = parseTransitionFieldPatch(form);
    if (!parsed.ok) {
      setFieldErrors(parsed.fields);
      setActionError(null);
      return;
    }
    startSave(async () => {
      try {
        await updateTransition(t.id!, parsed.patch);
        setActionError(null);
        setFieldErrors({});
        setPanelMode("view");
        await onNeighborhoodChange();
      } catch (err) {
        setActionError(describeApiError(err, { fallback: "Failed to save transition." }));
      }
    });
  }

  function onDelete() {
    if (!t?.id) {
      setActionError("This transition has no stable id yet.");
      return;
    }
    const confirmed = window.confirm(
      `Delete the transition to “${neighbor.title}”? Sibling transitions stay intact.`,
    );
    if (!confirmed) return;
    startDelete(async () => {
      try {
        await deleteTransition(t.id!);
        setActionError(null);
        setPanelMode("view");
        await onNeighborhoodChange();
      } catch (err) {
        setActionError(describeApiError(err, { fallback: "Failed to delete transition." }));
      }
    });
  }

  return (
    <div className="border-border space-y-3 border-t px-4 py-3">
      {edges.length > 1 ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="listbox"
          aria-label="Transitions to this track"
        >
          {edges.map((edge, edgeIndex) => {
            const key = edgeKey(edge, `${neighbor.id}-${edgeIndex}`);
            const selectedEdge = key === selectedKey;
            const label = [
              formatGraphLabel(edge.quality) ?? "Unrated",
              formatGraphLabel(edge.technique),
              edge.fromBar != null ? `bar ${edge.fromBar}` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={selectedEdge}
                onClick={() => {
                  onSelectKey(key);
                  setPanelMode("view");
                  setActionError(null);
                }}
                className={
                  selectedEdge
                    ? "border-foreground/40 bg-surface-2 rounded-md border px-2.5 py-1 text-left text-xs"
                    : "border-border hover:bg-surface-1 rounded-md border px-2.5 py-1 text-left text-xs"
                }
              >
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground ml-1.5">
                  {provenanceLabel(edge).kind === "ai" ? "note" : "manual"}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {t && panelMode === "view" ? (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {technique ? <Badge variant="outline">{technique}</Badge> : null}
            {intent ? <Badge variant="secondary">{intent}</Badge> : null}
            <p className="text-caption">
              {provenance?.kind === "ai" ? "From note" : "Manual"}
              {provenance?.noteId ? (
                <>
                  {" · "}
                  <Link
                    href={`/library/submissions/${provenance.noteId}`}
                    className="underline-offset-4 hover:underline"
                  >
                    Source submission
                  </Link>
                </>
              ) : null}
            </p>
          </div>

          {t.notes ? (
            <p className="line-clamp-2 text-sm leading-snug text-pretty">{t.notes}</p>
          ) : null}

          <BarChart transition={t} />
          <QualityMeter transition={t} />

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onChoose} disabled={choosing}>
              Choose this track
            </Button>
            {t.id ? (
              <>
                <Button type="button" size="sm" variant="outline" onClick={openEdit}>
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deleting}
                  onClick={onDelete}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {t && panelMode === "edit" ? (
        <div className="space-y-3">
          <h3 className="text-card-title">Edit transition</h3>
          <TransitionFields
            idPrefix={`graph-edit-${edgeKey(t, neighbor.id)}`}
            values={form}
            errors={fieldErrors}
            compact
            disabled={saving}
            onChange={(field, value) => {
              setForm((current) => ({ ...current, [field]: value }));
              setFieldErrors((current) => omitFieldError(current, field));
              setActionError(null);
            }}
          />
          {actionError ? <Alert variant="destructive">{actionError}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={onSaveEdit}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setPanelMode("view");
                setActionError(null);
                setFieldErrors({});
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {actionError && panelMode === "view" ? (
        <Alert variant="destructive">{actionError}</Alert>
      ) : null}
    </div>
  );
}
