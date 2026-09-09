"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";

import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import {
  alternateDesc,
  alternateVisual,
  canExpandAlternate,
  spanRange,
} from "@/lib/sequences/alternates";
import type { SequenceAlternate, SequenceDetail, SequenceStep } from "@/lib/sequences/types";
import { addTransitionHref } from "@/lib/sequences/view";

import { MixInspector } from "./mix-inspector";

export function AlternateList({
  items,
  steps,
  showGhost,
  ghostFromTrackId,
  ghostToTrackId,
  expandedIds,
  childById,
  childErrorById,
  onToggleExpand,
  onRemove,
  onCommitLabel,
}: {
  items: SequenceAlternate[];
  steps: SequenceStep[];
  showGhost: boolean;
  ghostFromTrackId: string | null;
  ghostToTrackId: string | null;
  expandedIds: Record<string, boolean>;
  childById: Record<string, SequenceDetail>;
  childErrorById: Record<string, string>;
  onToggleExpand: (item: SequenceAlternate) => void;
  onRemove: (item: SequenceAlternate) => void;
  onCommitLabel: (item: SequenceAlternate, label: string) => void;
}) {
  if (items.length === 0 && !showGhost) return null;

  return (
    <div className="flex flex-col gap-1 pl-0.5">
      {items.map((item) => (
        <AlternateRow
          key={item.id}
          item={item}
          steps={steps}
          expanded={Boolean(expandedIds[item.id])}
          child={item.altBlockId ? (childById[item.altBlockId] ?? null) : null}
          childError={item.altBlockId ? (childErrorById[item.altBlockId] ?? null) : null}
          onToggleExpand={() => onToggleExpand(item)}
          onRemove={() => onRemove(item)}
          onCommitLabel={(label) => onCommitLabel(item, label)}
        />
      ))}
      {showGhost && ghostFromTrackId && ghostToTrackId ? (
        <div className="border-destructive-subtle bg-destructive-subtle text-destructive flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">
            ○ no connector for this rejoin yet
          </span>
          <Button asChild variant="link" size="xs">
            <Link
              href={addTransitionHref(ghostFromTrackId, ghostToTrackId)}
              onClick={(event) => event.stopPropagation()}
            >
              Add transition
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AlternateRow({
  item,
  steps,
  expanded,
  child,
  childError,
  onToggleExpand,
  onRemove,
  onCommitLabel,
}: {
  item: SequenceAlternate;
  steps: SequenceStep[];
  expanded: boolean;
  child: SequenceDetail | null;
  childError: string | null;
  onToggleExpand: () => void;
  onRemove: () => void;
  onCommitLabel: (label: string) => void;
}) {
  const visual = alternateVisual(item);
  const range = spanRange(steps, item.fromStepId, item.toStepId);
  const fromTitle = range?.predecessor.track?.title ?? "Track";
  const toTitle = range?.destination.track?.title ?? "Track";
  const desc = alternateDesc(item, fromTitle, toTitle);
  const stepCount = range ? range.toIdx - range.fromIdx + 1 : 1;
  const expandable = canExpandAlternate(item);
  const inspectable = item.valid && item.altTransition != null;
  const [inspectOpen, setInspectOpen] = useState(false);
  const rowClass =
    visual === "broken"
      ? "text-destructive"
      : visual === "incomplete"
        ? "text-warning"
        : "text-muted-foreground";

  function stop(event: MouseEvent) {
    event.stopPropagation();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={cn("flex items-center gap-2 text-[12.5px]", rowClass)}>
        <span className="text-brand shrink-0">⤷</span>
        <span className="text-foreground shrink-0 font-medium">alt ·</span>
        <AlternateLabel
          label={item.label}
          disabled={visual === "broken"}
          onCommit={onCommitLabel}
        />
        <span
          className={cn("min-w-0 truncate", inspectable && "text-foreground cursor-pointer")}
          role={inspectable ? "button" : undefined}
          tabIndex={inspectable ? 0 : undefined}
          aria-expanded={inspectable ? inspectOpen : undefined}
          onClick={
            inspectable
              ? (event) => {
                  stop(event);
                  setInspectOpen((current) => !current);
                }
              : undefined
          }
          onKeyDown={
            inspectable
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setInspectOpen((current) => !current);
                  }
                }
              : undefined
          }
        >
          {visual === "broken"
            ? "this alternate no longer fits — taking this would strand you"
            : desc}
          {visual === "incomplete" ? " · open joins inside" : ""}
        </span>
        {stepCount > 1 && visual !== "broken" ? (
          <span className="text-caption shrink-0">
            covers {stepCount} steps · {fromTitle} → {toTitle}
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {expandable ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={(event) => {
                stop(event);
                onToggleExpand();
              }}
            >
              {expanded ? "Collapse" : "Expand"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="hover:bg-destructive-subtle hover:text-destructive"
            onClick={(event) => {
              stop(event);
              onRemove();
            }}
          >
            remove
          </Button>
        </span>
      </div>
      {inspectable && inspectOpen && item.altTransition ? (
        <MixInspector transition={item.altTransition} />
      ) : null}
      {expandable && expanded ? (
        <div className="border-border bg-surface-1 flex flex-col gap-1 rounded-[10px] border border-dashed px-3 py-2">
          {item.altBlockId ? (
            <>
              <span className="text-eyebrow">Inside this block · read-only</span>
              {childError ? <p className="text-caption text-destructive">{childError}</p> : null}
              {!child && !childError ? <p className="text-caption">Loading…</p> : null}
              {child
                ? child.steps.map((inner, index) => (
                    <ReadOnlyTrackRow
                      key={inner.id}
                      n={index + 1}
                      title={inner.track?.title ?? "Track"}
                      artist={inner.track?.artists[0] ?? ""}
                    />
                  ))
                : null}
            </>
          ) : null}
          {stepCount > 1 ? (
            <>
              <span className="text-eyebrow">Covers · read-only</span>
              {range
                ? steps
                    .slice(range.fromIdx, range.toIdx + 1)
                    .map((step, index) => (
                      <ReadOnlyTrackRow
                        key={step.id}
                        n={index + 1}
                        title={step.track?.title ?? "Track"}
                        artist={step.track?.artists[0] ?? ""}
                      />
                    ))
                : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AlternateLabel({
  label,
  disabled,
  onCommit,
}: {
  label: string | null;
  disabled: boolean;
  onCommit: (label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label ?? "");
  const display = label?.trim() || "unlabeled";

  if (disabled) {
    return <span className="text-foreground font-medium">{display}</span>;
  }
  if (editing) {
    return (
      <input
        value={draft}
        aria-label="Alternate label"
        className="border-input text-foreground h-6 min-w-32 rounded-md border bg-transparent px-1.5 text-[12.5px] font-medium outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        autoFocus
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const next = draft.trim();
          setEditing(false);
          if (next && next !== (label ?? "").trim()) onCommit(next);
          else setDraft(label ?? "");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
          if (event.key === "Escape") {
            setDraft(label ?? "");
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      title="Edit label"
      className="text-foreground hover:bg-surface-2 rounded-md px-0.5 font-medium"
      onClick={(event) => {
        event.stopPropagation();
        setDraft(label ?? "");
        setEditing(true);
      }}
    >
      {display}
    </button>
  );
}

function ReadOnlyTrackRow({ n, title, artist }: { n: number; title: string; artist: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-crate-meta w-3.5">{n}</span>
      <span className="truncate">{title}</span>
      <span className="text-caption truncate">{artist}</span>
    </div>
  );
}
