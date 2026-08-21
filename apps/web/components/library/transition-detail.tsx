"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { ConfirmDialog } from "@selecta/ui/components/confirm-dialog";
import { PageBreadcrumb, PageHeader } from "@selecta/ui/components/page-header";
import { StatePanel } from "@selecta/ui/components/state-panel";

import { BackLink } from "@/components/common/back-link";
import { omitFieldError } from "@/components/common/form-field";
import { TransitionView } from "@/components/library/transition-view";
import {
  parseTransitionFieldPatch,
  TransitionFields,
  transitionFieldsFromEdge,
  type TransitionFieldErrors,
  type TransitionFieldValues,
} from "@/components/tracks/transition-fields";
import { describeApiError } from "@/lib/api/errors";
import { libraryViewHref } from "@/lib/library/add-routes";
import { invalidateLibraryCache } from "@/lib/library-cache";
import {
  deleteTransition,
  getTransition,
  updateTransition,
  type ApiTransition,
} from "@/lib/transitions/api";

export function TransitionDetail({ transitionId }: { transitionId: string }) {
  const router = useRouter();
  const [transition, setTransition] = useState<ApiTransition | null>(null);
  const [form, setForm] = useState<TransitionFieldValues | null>(null);
  const [editing, setEditing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<TransitionFieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  const listHref = libraryViewHref("transitions");

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getTransition(transitionId);
        if (cancelled) return;
        setTransition(response.transition);
        setForm(transitionFieldsFromEdge(response.transition));
        setEditing(false);
        setFieldErrors({});
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setTransition(null);
        setForm(null);
        setEditing(false);
        setLoadError(describeApiError(err, { fallback: "Failed to load transition." }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [transitionId]);

  if (loading && !transition) {
    return <StatePanel variant="loading">Loading transition…</StatePanel>;
  }

  if (loadError || !transition || !form) {
    return (
      <div className="space-y-4">
        <BackLink href={listHref}>Library</BackLink>
        <Alert variant="destructive">{loadError ?? "Transition not found."}</Alert>
      </div>
    );
  }

  function onFieldChange(field: keyof TransitionFieldValues, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => omitFieldError(current, field));
    setSaveError(null);
  }

  function startEditing() {
    if (!transition) return;
    setForm(transitionFieldsFromEdge(transition));
    setFieldErrors({});
    setSaveError(null);
    setDeleteError(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (!transition) return;
    setForm(transitionFieldsFromEdge(transition));
    setFieldErrors({});
    setSaveError(null);
    setEditing(false);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !transition) return;

    const parsed = parseTransitionFieldPatch(form);
    if (!parsed.ok) {
      setFieldErrors(parsed.fields);
      setSaveError(null);
      return;
    }

    startSave(async () => {
      try {
        const response = await updateTransition(transition.id, parsed.patch);
        setTransition(response.transition);
        setForm(transitionFieldsFromEdge(response.transition));
        setFieldErrors({});
        setSaveError(null);
        setEditing(false);
        invalidateLibraryCache();
      } catch (err) {
        setSaveError(describeApiError(err, { fallback: "Failed to save transition." }));
      }
    });
  }

  function confirmDelete() {
    if (!transition) return;
    setDeleteOpen(false);
    startDelete(async () => {
      try {
        await deleteTransition(transition.id);
        invalidateLibraryCache();
        router.push(listHref);
        router.refresh();
      } catch (err) {
        setDeleteError(describeApiError(err, { fallback: "Failed to delete transition." }));
      }
    });
  }

  const deleteDialog = (
    <ConfirmDialog
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title="Delete transition?"
      description={`Delete the transition from “${transition.fromTrack.title}” to “${transition.toTrack.title}”? This cannot be undone.`}
      confirmLabel="Delete"
      pending={deleting}
      pendingLabel="Deleting…"
      onConfirm={confirmDelete}
    />
  );

  if (editing) {
    return (
      <div className="space-y-10">
        {deleteDialog}
        <PageHeader
          lead={
            <>
              <BackLink href={listHref}>Library</BackLink>
              <PageBreadcrumb>Edit transition</PageBreadcrumb>
            </>
          }
          title={
            <>
              {transition.fromTrack.title}
              <span className="text-muted-foreground font-normal"> → </span>
              {transition.toTrack.title}
            </>
          }
          actions={
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || deleting}
                onClick={cancelEditing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting || saving}
                onClick={() => setDeleteOpen(true)}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          }
        />

        {deleteError ? <Alert variant="destructive">{deleteError}</Alert> : null}

        <form onSubmit={onSubmit} className="space-y-6">
          <TransitionFields
            idPrefix="transition"
            values={form}
            onChange={onFieldChange}
            errors={fieldErrors}
            disabled={saving}
          />
          {saveError ? <Alert variant="destructive">{saveError}</Alert> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving || deleting}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={cancelEditing}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {deleteDialog}
      <div className="space-y-3">
        <BackLink href={listHref}>Library</BackLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PageBreadcrumb>Transition</PageBreadcrumb>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={startEditing}>
              Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => setDeleteOpen(true)}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </div>

      {deleteError ? <Alert variant="destructive">{deleteError}</Alert> : null}

      <TransitionView transition={transition} />

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/graph?track=${encodeURIComponent(transition.fromTrack.id)}`}>
            Open in graph
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={listHref}>Back to transitions</Link>
        </Button>
      </div>
    </div>
  );
}
