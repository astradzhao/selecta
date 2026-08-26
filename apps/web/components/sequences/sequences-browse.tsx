"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { ConfirmDialog } from "@selecta/ui/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@selecta/ui/components/dialog";
import { Input } from "@selecta/ui/components/input";
import { PageHeader } from "@selecta/ui/components/page-header";
import { SearchField } from "@selecta/ui/components/search-field";
import { SegmentedTab, SegmentedTabs } from "@selecta/ui/components/segmented-tabs";
import { Select } from "@selecta/ui/components/select";
import { useToast } from "@selecta/ui/components/toast";

import {
  ClearFiltersButton,
  FilterField,
  FilteredListShell,
} from "@/components/common/filtered-list-shell";
import { FormField } from "@/components/common/form-field";
import { useFilteredList } from "@/hooks/use-filtered-list";
import { describeApiError } from "@/lib/api/errors";
import { formatCompactAge } from "@/lib/format";
import { formatListCount } from "@/lib/library/list-view-state";
import { createSequence, deleteSequence, listSequences } from "@/lib/sequences/api";
import type { SequenceKind, SequenceRecord } from "@/lib/sequences/types";
import { sequenceWorkspaceHref, setsViewHref, type SetsView } from "@/lib/sequences/view";

const VIEWS: Array<{ id: SetsView; label: string }> = [
  { id: "sets", label: "Sets" },
  { id: "blocks", label: "Blocks" },
];

type CompletenessFilter = "all" | "complete" | "incomplete";

function kindForView(view: SetsView): SequenceKind {
  return view === "blocks" ? "block" : "set";
}

function rowMeta(row: SequenceRecord): string {
  if (row.stepCount === 0) return "empty";
  const tracks = `${row.stepCount} ${row.stepCount === 1 ? "track" : "tracks"}`;
  if (row.seamCount === 0) return tracks;
  return `${tracks} · ${row.seamCount} ${row.seamCount === 1 ? "seam" : "seams"}`;
}

function completenessBadge(row: SequenceRecord): {
  label: string;
  variant: "success" | "tertiary";
} {
  if (row.stepCount === 0) return { label: "empty", variant: "tertiary" };
  if (row.isComplete) return { label: "complete", variant: "success" };
  return { label: "incomplete", variant: "tertiary" };
}

export function SequencesBrowse({ view }: { view: SetsView }) {
  const router = useRouter();
  const { toast } = useToast();
  const kind = kindForView(view);
  const isBlocksTab = view === "blocks";
  const [query, setQuery] = useState("");
  const [completeFilter, setCompleteFilter] = useState<CompletenessFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SequenceRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [listEpoch, setListEpoch] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      kind,
      query,
      complete: isBlocksTab
        ? completeFilter === "all"
          ? undefined
          : completeFilter === "complete"
        : undefined,
      listEpoch,
    }),
    [completeFilter, isBlocksTab, kind, listEpoch, query],
  );
  const hasFilters = Boolean(query || (isBlocksTab && completeFilter !== "all"));

  const fetchPage = useCallback(async (next: typeof filters) => {
    const result = await listSequences({
      kind: next.kind,
      query: next.query,
      complete: next.complete,
      limit: 50,
    });
    return { items: result.sequences, hasMore: result.hasMore };
  }, []);

  const list = useFilteredList({
    filters,
    fetchPage,
    resource: isBlocksTab ? "blocks" : "sets",
  });

  function setView(next: SetsView) {
    setQuery("");
    setCompleteFilter("all");
    router.replace(setsViewHref(next));
  }

  async function handleCreate() {
    const title = createTitle.trim();
    if (!title || creating) return;
    setCreating(true);
    setFormError(null);
    try {
      const result = await createSequence({ kind, title });
      setCreateOpen(false);
      setCreateTitle("");
      toast(`Created “${result.sequence.title}”`);
      router.push(sequenceWorkspaceHref(result.sequence.kind, result.sequence.id));
    } catch (err) {
      setFormError(describeApiError(err, { resource: isBlocksTab ? "block" : "set" }));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const title = pendingDelete.title;
      await deleteSequence(pendingDelete.id);
      setPendingDelete(null);
      toast(`Deleted “${title}”`);
      setListEpoch((value) => value + 1);
    } catch (err) {
      toast(describeApiError(err, { fallback: "Could not delete the sequence." }));
    } finally {
      setDeleting(false);
    }
  }

  const newLabel = isBlocksTab ? "New block" : "New set";
  const createDisabled = createTitle.trim().length === 0 || creating;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sets"
        description={
          isBlocksTab
            ? "Reusable runs. Drop one into a set as a single connector."
            : "Nights you mean to play, in order."
        }
        className="space-y-6 border-b-0 pb-0"
        actions={
          <Button
            type="button"
            onClick={() => {
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            <PlusIcon />
            {newLabel}
          </Button>
        }
      >
        <SegmentedTabs aria-label="Sequence kind">
          {VIEWS.map((item) => {
            const active = item.id === view;
            return (
              <SegmentedTab
                key={item.id}
                asChild
                active={active}
                onClick={(event) => {
                  event.preventDefault();
                  setView(item.id);
                }}
              >
                <Link href={setsViewHref(item.id)}>{item.label}</Link>
              </SegmentedTab>
            );
          })}
        </SegmentedTabs>
      </PageHeader>

      <FilteredListShell
        filtersAriaLabel={isBlocksTab ? "Block filters" : "Set filters"}
        listAriaLabel={isBlocksTab ? "Blocks" : "Sets"}
        filterGridClassName={isBlocksTab ? "md:grid-cols-[minmax(0,1fr)_9.375rem]" : ""}
        filterControls={
          <>
            <FilterField htmlFor="sets-q" label="Search">
              <SearchField
                id="sets-q"
                placeholder={isBlocksTab ? "Search blocks" : "Search sets"}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </FilterField>
            {isBlocksTab ? (
              <FilterField htmlFor="sets-complete" label="Completeness">
                <Select
                  id="sets-complete"
                  value={completeFilter}
                  onChange={(event) => setCompleteFilter(event.target.value as CompletenessFilter)}
                >
                  <option value="all">All blocks</option>
                  <option value="complete">Complete</option>
                  <option value="incomplete">Incomplete</option>
                </Select>
              </FilterField>
            ) : null}
          </>
        }
        filterBar={
          hasFilters ? (
            <ClearFiltersButton
              onClick={() => {
                setQuery("");
                setCompleteFilter("all");
              }}
            />
          ) : null
        }
        count={
          <span className="text-numeric">
            {formatListCount(list.items.length, {
              singular: isBlocksTab ? "block" : "set",
              plural: isBlocksTab ? "blocks" : "sets",
              hasMore: list.hasMore,
            })}
          </span>
        }
        unavailableTitle={isBlocksTab ? "Blocks unavailable" : "Sets unavailable"}
        loadingAriaLabel={isBlocksTab ? "Loading blocks" : "Loading sets"}
        error={list.error}
        hasFetched={list.hasFetched}
        hasFilters={hasFilters}
        items={list.items}
        getItemKey={(row) => row.id}
        renderRow={(row) => {
          const badge = completenessBadge(row);
          return (
            <li data-slot="data-list-row">
              <div className="hover:bg-surface-2 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-4 px-3.5">
                <Link
                  href={sequenceWorkspaceHref(row.kind, row.id)}
                  className="min-w-0 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 rounded-lg focus-visible:outline-none"
                >
                  <span className="text-card-title block truncate">{row.title}</span>
                  <span className="text-caption mt-0.5 block">{rowMeta(row)}</span>
                </Link>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-crate-meta">{formatCompactAge(row.updatedAt)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Delete"
                  aria-label={`Delete ${row.title}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setPendingDelete(row);
                  }}
                >
                  <XIcon />
                </Button>
              </div>
            </li>
          );
        }}
        empty={{
          noneTitle: isBlocksTab ? "No blocks yet" : "No sets yet",
          noneDescription: isBlocksTab
            ? "A block is a short run you rehearse once and reuse — the joins between blocks are the seams you improvise."
            : "Start a night, put the tracks in order, and plan the joins you care about.",
          filteredTitle: query.trim()
            ? `Nothing matches “${query.trim()}”`
            : "No matching sequences",
          action: (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              {newLabel}
            </Button>
          ),
        }}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateTitle("");
            setFormError(null);
          }
        }}
      >
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <DialogHeader>
              <DialogTitle>{newLabel}</DialogTitle>
              <DialogDescription>
                {isBlocksTab
                  ? "A reusable run you can drop into any set as one connector."
                  : "A night you mean to play, in order."}
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <FormField id="new-sequence-title" label="Title" error={formError}>
                <Input
                  value={createTitle}
                  autoFocus
                  placeholder={isBlocksTab ? "Warm-up run" : "Sunset rooftop"}
                  onChange={(event) => setCreateTitle(event.target.value)}
                />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDisabled}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={pendingDelete ? `Delete “${pendingDelete.title}”?` : "Delete sequence?"}
        description="The tracks and transitions stay in your library — only this sequence and its ordering go away. This cannot be undone."
        confirmLabel="Delete"
        pending={deleting}
        pendingLabel="Deleting…"
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
