"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { ConfirmDialog } from "@selecta/ui/components/confirm-dialog";
import { PageBreadcrumb, PageHeader } from "@selecta/ui/components/page-header";
import { SectionHeading } from "@selecta/ui/components/section-heading";
import { StatePanel } from "@selecta/ui/components/state-panel";

import { omitFieldError } from "@/components/common/form-field";
import {
  parseTransitionFieldPatch,
  TransitionFields,
  transitionFieldsFromEdge,
  type TransitionFieldErrors,
  type TransitionFieldValues,
} from "@/components/tracks/transition-fields";
import { describeApiError } from "@/lib/api/errors";
import { artistLine, formatTimestamp } from "@/lib/format";
import { libraryViewHref } from "@/lib/library/add-routes";
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
  const [fieldErrors, setFieldErrors] = useState<TransitionFieldErrors>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getTransition(transitionId);
        if (cancelled) return;
        setTransition(response.transition);
        setForm(transitionFieldsFromEdge(response.transition));
        setFieldErrors({});
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setTransition(null);
        setForm(null);
        setLoadError(describeApiError(err, { fallback: "Failed to load transition." }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [transitionId]);

  const listHref = libraryViewHref("transitions");

  if (loading && !transition) {
    return <StatePanel variant="loading">Loading transition…</StatePanel>;
  }

  if (loadError || !transition || !form) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">{loadError ?? "Transition not found."}</Alert>
        <Button asChild variant="outline">
          <Link href={listHref}>Back to transitions</Link>
        </Button>
      </div>
    );
  }

  function onFieldChange(field: keyof TransitionFieldValues, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => omitFieldError(current, field));
    setSaveError(null);
    setSaveMessage(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !transition) return;

    const parsed = parseTransitionFieldPatch(form);
    if (!parsed.ok) {
      setFieldErrors(parsed.fields);
      setSaveError(null);
      setSaveMessage(null);
      return;
    }

    startSave(async () => {
      try {
        const response = await updateTransition(transition.id, parsed.patch);
        setTransition(response.transition);
        setForm(transitionFieldsFromEdge(response.transition));
        setFieldErrors({});
        setSaveError(null);
        setSaveMessage("Saved.");
      } catch (err) {
        setSaveMessage(null);
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
        router.push(listHref);
        router.refresh();
      } catch (err) {
        setDeleteError(describeApiError(err, { fallback: "Failed to delete transition." }));
      }
    });
  }

  return (
    <div className="space-y-10">
      <PageHeader
        lead={
          <PageBreadcrumb>
            <Link href={listHref} className="hover:text-foreground transition-colors">
              Transitions
            </Link>
            {" / "}
            Detail
          </PageBreadcrumb>
        }
        title={
          <>
            {transition.fromTrack.title}
            <span className="text-muted-foreground font-normal"> → </span>
            {transition.toTrack.title}
          </>
        }
        description={
          <>
            {artistLine(transition.fromTrack.artists)}
            <span className="text-muted-foreground/70"> → </span>
            {artistLine(transition.toTrack.artists)}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {transition.technique ? <Badge variant="secondary">{transition.technique}</Badge> : null}
          {transition.intent ? <Badge variant="outline">{transition.intent}</Badge> : null}
          {transition.quality ? <Badge variant="outline">{transition.quality}</Badge> : null}
          <span className="text-caption text-numeric">
            Created {formatTimestamp(transition.createdAt)}
            {transition.updatedAt !== transition.createdAt
              ? ` · updated ${formatTimestamp(transition.updatedAt)}`
              : null}
          </span>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button asChild variant="outline" size="sm">
            <Link href={`/tracks/${transition.fromTrack.id}`}>From track</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/tracks/${transition.toTrack.id}`}>To track</Link>
          </Button>
          {transition.sourceSubmissionId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/library/submissions/${transition.sourceSubmissionId}`}>
                Source submission
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/graph?track=${encodeURIComponent(transition.fromTrack.id)}`}>
              Open in graph
            </Link>
          </Button>
        </div>
      </PageHeader>

      <form onSubmit={onSubmit} className="space-y-6">
        <TransitionFields
          idPrefix="transition"
          values={form}
          onChange={onFieldChange}
          errors={fieldErrors}
          disabled={saving}
        />

        {saveError ? <Alert variant="destructive">{saveError}</Alert> : null}
        {saveMessage ? <Alert variant="success">{saveMessage}</Alert> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href={listHref}>Back to transitions</Link>
          </Button>
        </div>
      </form>

      <section className="border-border space-y-3 border-t pt-8">
        <SectionHeading
          title="Delete"
          hint="Removes this committed transition edge from the graph. Source submissions stay intact."
        />
        {deleteError ? <Alert variant="destructive">{deleteError}</Alert> : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={() => setDeleteOpen(true)}
        >
          {deleting ? "Deleting…" : "Delete transition"}
        </Button>
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
      </section>
    </div>
  );
}
