"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { cn } from "@selecta/ui/lib/utils";

import {
  emptyTransitionFields,
  parseTransitionFieldPatch,
  TransitionFields,
  transitionFieldsFromEdge,
  type TransitionFieldValues,
} from "@/components/tracks/transition-fields";
import { ApiClientError } from "@/lib/api/client";
import {
  beginArtFlight,
  HERO_ART_SIZE,
  HOP_COPY_IN_MS,
  HOP_COPY_OUT_MS,
  HOP_FLIGHT_MS,
  nextFrame,
  prefersReducedMotion,
  wait,
} from "@/lib/motion";
import {
  getTrackNeighborhood,
  listTracks,
  type ApiNeighborhoodCurrent,
  type ApiNeighborhoodNeighbor,
  type ApiTrack,
  type ApiTransitionEdge,
} from "@/lib/tracks/api";
import { hopGraphSession, popGraphTrail, useGraphSession } from "@/lib/tracks/graph-session-store";
import { createTransition, deleteTransition, updateTransition } from "@/lib/transitions/api";

/** Copy/meta opacity during a hop — opacity only, never translate/scale (those snap). */
type CopyPhase = "visible" | "out" | "hidden" | "in";

/** Durations must match HOP_* in lib/motion — one timeline for exit, flight, enter. */
const COPY_PHASE_CLASS: Record<CopyPhase, string> = {
  visible: "opacity-100",
  out: "opacity-0 ease-in",
  hidden: "opacity-0 duration-0",
  in: "opacity-100 ease-out",
};

const COPY_PHASE_DURATION: Record<CopyPhase, number | undefined> = {
  visible: undefined,
  out: HOP_COPY_OUT_MS,
  hidden: 0,
  in: HOP_COPY_IN_MS,
};

function copyPhaseStyle(phase: CopyPhase): { transitionDuration?: string } | undefined {
  const ms = COPY_PHASE_DURATION[phase];
  return ms == null ? undefined : { transitionDuration: `${ms}ms` };
}

type Neighborhood = {
  current: ApiNeighborhoodCurrent;
  neighbors: ApiNeighborhoodNeighbor[];
};

function artistLine(artists: { name: string }[]): string {
  return artists.map((a) => a.name).join(", ") || "Unknown artist";
}

function formatLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function qualityTone(quality: string | null): "default" | "secondary" | "outline" {
  if (quality === "great") return "default";
  if (quality === "ok") return "secondary";
  return "outline";
}

function edgeKey(edge: ApiTransitionEdge, fallback: string): string {
  return edge.id ?? edge.proposalKey ?? fallback;
}

function provenanceLabel(edge: ApiTransitionEdge): {
  kind: "manual" | "ai";
  noteId: string | null;
} {
  const isAi = Boolean(edge.proposalKey || edge.sourceNoteId);
  return { kind: isAi ? "ai" : "manual", noteId: edge.sourceNoteId };
}

function Artwork({
  url,
  size,
  className,
  artRole,
  sizes,
  priority = false,
}: {
  url: string | null;
  size: number;
  className?: string;
  artRole?: "card" | "hero";
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div
      data-art-role={artRole}
      className={cn("bg-muted relative shrink-0 overflow-hidden rounded-2xl", className)}
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          priority={priority}
          className="object-cover"
          sizes={sizes ?? `${size}px`}
        />
      ) : (
        <div className="text-eyebrow text-muted-foreground/40 flex h-full w-full items-center justify-center">
          No art
        </div>
      )}
    </div>
  );
}

function BarStrip({ transition }: { transition: ApiTransitionEdge }) {
  const fromBar = transition.fromBar;
  const toBar = transition.toBar;
  if (fromBar == null && toBar == null && transition.barsOverlap == null) {
    return null;
  }

  const maxBar = Math.max(fromBar ?? 0, toBar ?? 0, 16);
  const ticks = Math.min(32, Math.max(8, Math.ceil(maxBar / 4) * 4));

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-eyebrow">Bars</p>
        <p className="text-numeric text-caption">
          {[
            fromBar != null ? `out ${fromBar}` : null,
            toBar != null ? `in ${toBar}` : null,
            transition.barsOverlap != null ? `overlap ${transition.barsOverlap}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div
        className="border-border bg-surface-2 relative flex h-6 items-end gap-px overflow-hidden rounded-md border px-1 py-1"
        role="img"
        aria-label={[
          fromBar != null ? `Leave at bar ${fromBar}` : null,
          toBar != null ? `Enter at bar ${toBar}` : null,
          transition.barsOverlap != null ? `${transition.barsOverlap} bar overlap` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        {Array.from({ length: ticks }, (_, i) => {
          const bar = i + 1;
          const isFrom = fromBar != null && bar === fromBar;
          const isTo = toBar != null && bar === toBar;
          const inOverlap =
            fromBar != null &&
            transition.barsOverlap != null &&
            bar >= fromBar &&
            bar < fromBar + transition.barsOverlap;
          return (
            <div
              key={bar}
              className={cn(
                "min-w-0 flex-1 rounded-[1px]",
                isFrom || isTo
                  ? "bg-foreground h-full"
                  : inOverlap
                    ? "bg-foreground/45 h-[70%]"
                    : bar % 4 === 0
                      ? "bg-foreground/20 h-[45%]"
                      : "bg-foreground/10 h-[28%]",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function TransitionMeters({ transition }: { transition: ApiTransitionEdge }) {
  const qualityRank =
    transition.quality === "great"
      ? 1
      : transition.quality === "ok"
        ? 0.55
        : transition.quality === "risky"
          ? 0.25
          : null;
  const confidence =
    transition.confidence != null && Number.isFinite(transition.confidence)
      ? Math.min(1, Math.max(0, transition.confidence))
      : null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <MeterRow
        label="Quality"
        valueLabel={formatLabel(transition.quality) ?? "Unrated"}
        fill={qualityRank}
      />
      <MeterRow
        label="Confidence"
        valueLabel={confidence != null ? `${Math.round(confidence * 100)}%` : "—"}
        fill={confidence}
      />
    </div>
  );
}

function MeterRow({
  label,
  valueLabel,
  fill,
}: {
  label: string;
  valueLabel: string;
  fill: number | null;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-numeric">{valueLabel}</span>
      </div>
      <div className="bg-muted h-1 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full",
            fill == null ? "bg-foreground/15" : "bg-foreground/70",
          )}
          style={{ width: `${Math.round((fill ?? 0.08) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function NeighborCard({
  neighbor,
  expanded,
  onToggle,
  onChoose,
  onPrefetch,
  onNeighborhoodChange,
  fadingOut,
  choosing,
  index,
  panelId,
  registerRef,
}: {
  neighbor: ApiNeighborhoodNeighbor;
  expanded: boolean;
  onToggle: () => void;
  onChoose: () => void;
  onPrefetch: () => void;
  onNeighborhoodChange: () => Promise<void>;
  fadingOut: boolean;
  choosing: boolean;
  index: number;
  panelId: string;
  registerRef: (element: HTMLElement | null) => void;
}) {
  const edges = neighbor.transitions;
  const defaultEdge = edges[0];
  const [selectedKey, setSelectedKey] = useState(() =>
    defaultEdge ? edgeKey(defaultEdge, neighbor.id) : neighbor.id,
  );
  const selected =
    edges.find((edge) => edgeKey(edge, neighbor.id) === selectedKey) ?? defaultEdge ?? null;

  useEffect(() => {
    const nextDefault = edges[0];
    if (!nextDefault) return;
    const stillPresent = edges.some((edge) => edgeKey(edge, neighbor.id) === selectedKey);
    if (!stillPresent) {
      setSelectedKey(edgeKey(nextDefault, neighbor.id));
    }
  }, [edges, neighbor.id, selectedKey]);

  const [panelMode, setPanelMode] = useState<"view" | "edit" | null>("view");
  const [form, setForm] = useState<TransitionFieldValues>(emptyTransitionFields());
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  const t = selected;
  const technique = t ? formatLabel(t.technique) : null;
  const intent = t ? formatLabel(t.intent) : null;
  const provenance = t ? provenanceLabel(t) : null;

  function openEdit() {
    if (!t) return;
    setForm(transitionFieldsFromEdge(t));
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
      setActionError(parsed.error);
      return;
    }
    startSave(async () => {
      try {
        await updateTransition(t.id!, parsed.patch);
        setActionError(null);
        setPanelMode("view");
        await onNeighborhoodChange();
      } catch (err) {
        setActionError(err instanceof ApiClientError ? err.message : "Failed to save transition.");
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
        setActionError(
          err instanceof ApiClientError ? err.message : "Failed to delete transition.",
        );
      }
    });
  }

  return (
    <li
      className={cn(
        "border-border bg-background overflow-hidden rounded-2xl border",
        "transition-[opacity,transform] ease-[cubic-bezier(0.2,0,0,1)]",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 fill-mode-both",
        "hover:border-foreground/20",
        fadingOut && "pointer-events-none opacity-0 motion-safe:translate-x-6",
        choosing && "pointer-events-none opacity-0",
      )}
      style={{
        animationDelay: `${Math.min(index, 8) * 30}ms`,
        animationDuration: `${HOP_COPY_IN_MS}ms`,
        transitionDuration: `${HOP_COPY_OUT_MS}ms`,
        transitionDelay: fadingOut ? `${Math.min(index, 6) * 22}ms` : undefined,
      }}
    >
      <button
        ref={registerRef}
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        onPointerEnter={onPrefetch}
        onFocus={onPrefetch}
        className={cn(
          "bg-background flex w-full items-start gap-3 px-4 py-3.5 text-left",
          "transition-colors duration-300",
          "hover:bg-surface-2 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          expanded && "bg-surface-1",
        )}
      >
        <Artwork
          url={neighbor.artworkUrl}
          size={56}
          artRole="card"
          sizes="220px"
          className="rounded-xl"
        />
        <div data-card-text className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-card-title truncate">{neighbor.title}</p>
              <p className="text-muted-foreground truncate text-sm">
                {artistLine(neighbor.artists)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {edges.length > 1 ? (
                <Badge variant="outline" className="text-numeric text-[11px]">
                  {edges.length}
                </Badge>
              ) : null}
              {t?.quality ? (
                <Badge variant={qualityTone(t.quality)} className="capitalize">
                  {t.quality}
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="text-caption text-numeric line-clamp-1">
            {t
              ? [
                  t.fromBar != null || t.toBar != null
                    ? `Bars ${t.fromBar ?? "—"} → ${t.toBar ?? "—"}`
                    : null,
                  technique,
                  intent,
                  edges.length > 1 ? `${edges.length} transitions` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Transition details"
              : "No transitions"}
          </p>
        </div>
        <span
          className={cn(
            "text-muted-foreground mt-1 shrink-0 text-xs transition-transform duration-300",
            expanded && "rotate-90",
          )}
          aria-hidden
        >
          ▸
        </span>
      </button>

      <div
        id={panelId}
        inert={!expanded}
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "border-border space-y-3 border-t px-4 py-3 transition-opacity duration-300",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
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
                    formatLabel(edge.quality) ?? "Unrated",
                    formatLabel(edge.technique),
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
                        setSelectedKey(key);
                        setPanelMode("view");
                        setActionError(null);
                      }}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-left text-xs transition-colors",
                        selectedEdge
                          ? "border-foreground/40 bg-surface-2"
                          : "border-border hover:bg-surface-1",
                      )}
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

                <BarStrip transition={t} />
                <TransitionMeters transition={t} />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={onChoose}
                    disabled={choosing}
                    className="transition-transform duration-200 active:scale-[0.98]"
                  >
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
                <p className="text-card-title">Edit transition</p>
                <TransitionFields
                  idPrefix={`graph-edit-${edgeKey(t, neighbor.id)}`}
                  values={form}
                  compact
                  disabled={saving}
                  onChange={(field, value) => {
                    setForm((current) => ({ ...current, [field]: value }));
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
        </div>
      </div>
    </li>
  );
}

function AddTransitionPanel({
  fromTrackId,
  excludeTrackId,
  onCreated,
  onCancel,
}: {
  fromTrackId: string;
  excludeTrackId: string;
  onCreated: () => Promise<void>;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiTrack[]>([]);
  const [selected, setSelected] = useState<ApiTrack | null>(null);
  const [form, setForm] = useState<TransitionFieldValues>(emptyTransitionFields());
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (!q || selected) {
      if (!q) setResults([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      startSearch(async () => {
        try {
          const response = await listTracks({ query: q, limit: 8 });
          if (cancelled) return;
          setResults(response.tracks.filter((track) => track.id !== excludeTrackId));
          setError(null);
        } catch (err) {
          if (cancelled) return;
          setResults([]);
          setError(err instanceof ApiClientError ? err.message : "Failed to search tracks.");
        }
      });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, selected, excludeTrackId]);

  function onSubmit() {
    if (!selected) {
      setError("Pick a destination track from your library.");
      return;
    }
    const parsed = parseTransitionFieldPatch(form);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    startSave(async () => {
      try {
        await createTransition({
          fromTrackId,
          toTrackId: selected.id,
          ...parsed.patch,
        });
        setError(null);
        await onCreated();
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : "Failed to create transition.");
      }
    });
  }

  return (
    <div className="border-border bg-surface-1 space-y-4 rounded-2xl border px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-card-title">Add transition</p>
          <p className="text-muted-foreground text-xs text-pretty">
            Pick an existing library track. Missing a song?{" "}
            <Link href="/add" className="underline-offset-4 hover:underline">
              Add it first
            </Link>
            .
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Close
        </Button>
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
          <div className="min-w-0">
            <p className="text-card-title truncate">{selected.title}</p>
            <p className="text-muted-foreground truncate text-xs">{artistLine(selected.artists)}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelected(null);
              setQuery("");
              setResults([]);
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search library tracks"
            aria-label="Search library tracks"
          />
          {searching ? <p className="text-caption">Searching…</p> : null}
          {results.length > 0 ? (
            <ul className="border-border max-h-40 space-y-1 overflow-y-auto rounded-lg border p-1">
              {results.map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    className="hover:bg-surface-2 w-full rounded-md px-2 py-1.5 text-left text-sm"
                    onClick={() => {
                      setSelected(track);
                      setQuery("");
                      setResults([]);
                      setError(null);
                    }}
                  >
                    <span className="text-card-title">{track.title}</span>
                    <span className="text-muted-foreground block text-xs">
                      {artistLine(track.artists)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <TransitionFields
        idPrefix="graph-add"
        values={form}
        compact
        disabled={saving}
        onChange={(field, value) => {
          setForm((current) => ({ ...current, [field]: value }));
          setError(null);
        }}
      />

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <Button type="button" disabled={saving || !selected} onClick={onSubmit}>
        {saving ? "Saving…" : "Create transition"}
      </Button>
    </div>
  );
}

export function GraphExplorer({ onExit }: { onExit: () => void }) {
  const { activeId: trackId, trail } = useGraphSession();
  const baseId = useId();
  const [current, setCurrent] = useState<ApiNeighborhoodCurrent | null>(null);
  const [neighbors, setNeighbors] = useState<ApiNeighborhoodNeighbor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startLoad] = useTransition();
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [artHidden, setArtHidden] = useState(false);
  const [copyPhase, setCopyPhase] = useState<CopyPhase>("visible");

  const loadedIdRef = useRef<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const requestsRef = useRef(new Map<string, Promise<Neighborhood>>());

  function loadNeighborhood(id: string, { bust = false } = {}): Promise<Neighborhood> {
    if (bust) requestsRef.current.delete(id);
    const inFlight = requestsRef.current.get(id);
    if (inFlight) return inFlight;
    const request = getTrackNeighborhood(id).then((response) => ({
      current: response.current,
      neighbors: response.neighbors,
    }));
    requestsRef.current.set(id, request);
    void request.catch(() => requestsRef.current.delete(id));
    return request;
  }

  async function refreshNeighborhood() {
    if (!trackId) return;
    const next = await loadNeighborhood(trackId, { bust: true });
    setCurrent(next.current);
    setNeighbors(next.neighbors);
    setError(null);
  }

  useEffect(() => {
    if (!trackId || loadedIdRef.current === trackId) return;
    let cancelled = false;
    startLoad(async () => {
      try {
        const next = await loadNeighborhood(trackId);
        if (cancelled) return;
        loadedIdRef.current = trackId;
        setCurrent(next.current);
        setNeighbors(next.neighbors);
        setError(null);
        setAdding(false);
      } catch (err) {
        if (cancelled) return;
        setCurrent(null);
        setNeighbors([]);
        setError(
          err instanceof ApiClientError ? err.message : "Failed to load graph neighborhood.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  async function goToTrack(nextId: string, sourceElement?: HTMLElement | null) {
    if (!trackId || choosingId || nextId === trackId) return;

    const request = loadNeighborhood(nextId).catch(() => null);
    const flight = beginArtFlight(
      sourceElement?.querySelector<HTMLElement>('[data-art-role="card"]'),
    );

    setChoosingId(nextId);
    setExpandedKey(null);
    setAdding(false);
    setCopyPhase("out");
    if (flight) setArtHidden(true);

    try {
      const next = await request;
      await wait(prefersReducedMotion() ? 0 : HOP_COPY_OUT_MS);

      loadedIdRef.current = next ? nextId : null;
      hopGraphSession(trackId, nextId);
      if (next) {
        setCurrent(next.current);
        setNeighbors(next.neighbors);
        setError(null);
      }
      setChoosingId(null);
      setCopyPhase("hidden");

      await nextFrame();
      const heroArt = panelRef.current?.querySelector<HTMLElement>('[data-art-role="hero"]');

      if (flight && heroArt) {
        await flight.landOn(heroArt, { duration: HOP_FLIGHT_MS, size: HERO_ART_SIZE });
      } else {
        await wait(prefersReducedMotion() ? 0 : HOP_FLIGHT_MS);
      }

      setArtHidden(false);
      await nextFrame();
      const heroImg = panelRef.current?.querySelector<HTMLImageElement>(
        '[data-art-role="hero"] img',
      );
      if (heroImg && !(heroImg.complete && heroImg.naturalWidth > 0)) {
        await Promise.race([
          new Promise<void>((resolve) => {
            heroImg.addEventListener("load", () => resolve(), { once: true });
            heroImg.addEventListener("error", () => resolve(), { once: true });
          }),
          wait(400),
        ]);
      }
      await nextFrame();
      if (flight) {
        await flight.fadeOut(prefersReducedMotion() ? 0 : 160);
        flight.destroy();
      }
      setCopyPhase("in");
      await wait(prefersReducedMotion() ? 0 : HOP_COPY_IN_MS);
      setCopyPhase("visible");
    } finally {
      setArtHidden(false);
      setCopyPhase("visible");
      if (flight) flight.destroy();
    }
  }

  function goBackInTrail() {
    if (choosingId) return;
    const previous = popGraphTrail();
    if (!previous) return;
    loadedIdRef.current = null;
    setExpandedKey(null);
    setAdding(false);
    setCopyPhase("visible");
  }

  if (!trackId) return null;

  if (pending && !current) {
    return (
      <p className="text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0 text-sm duration-300">
        Loading neighborhood…
      </p>
    );
  }

  if (error || !current) {
    return (
      <div className="motion-safe:animate-in motion-safe:fade-in-0 space-y-4 duration-500">
        <Alert variant="destructive">{error ?? "Track not found."}</Alert>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={onExit}>
            Back to Graph
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/tracks/${trackId}`}>Track detail</Link>
          </Button>
        </div>
      </div>
    );
  }

  const swapping = choosingId !== null;
  const destinationCount = neighbors.length;
  const transitionCount = neighbors.reduce((sum, neighbor) => sum + neighbor.transitions.length, 0);

  return (
    <div className="space-y-4">
      <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 flex flex-wrap items-center justify-between gap-3 duration-500">
        <p className="text-muted-foreground text-sm text-pretty">
          Expand a neighbor for mix detail, then choose it to traverse.
        </p>
        <Button type="button" variant="destructive" size="sm" onClick={onExit}>
          Exit
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.5fr)] lg:gap-6">
        <div className="relative">
          <div
            className={cn(
              "from-foreground/30 via-foreground/10 pointer-events-none absolute top-28 right-[-1.25rem] bottom-28 hidden w-10 bg-gradient-to-r to-transparent lg:block",
              "transition-opacity duration-500",
              swapping ? "opacity-0" : "opacity-100",
            )}
            aria-hidden
          />
          <section
            ref={panelRef}
            aria-labelledby="graph-current-heading"
            className="border-border bg-background sticky top-20 flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
          >
            <div key={current.id} className="flex flex-col gap-4">
              <Artwork
                url={current.artworkUrl}
                size={HERO_ART_SIZE}
                artRole="hero"
                priority
                className={cn("mx-auto sm:mx-0", artHidden && "opacity-0")}
              />
              <div
                data-hero-text
                className={cn(
                  "space-y-1 transition-opacity",
                  COPY_PHASE_CLASS[copyPhase],
                  copyPhase !== "visible" && "pointer-events-none",
                )}
                style={copyPhaseStyle(copyPhase)}
              >
                <p className="text-eyebrow">Now playing</p>
                <h1
                  id="graph-current-heading"
                  data-hero-title
                  className="text-card-title text-xl font-semibold tracking-tight"
                >
                  {current.title}
                </h1>
                <p data-hero-artist className="text-muted-foreground text-sm">
                  {artistLine(current.artists)}
                </p>
              </div>
              <div
                className={cn(
                  "flex flex-col gap-3 transition-opacity",
                  COPY_PHASE_CLASS[copyPhase],
                  copyPhase !== "visible" && "pointer-events-none",
                )}
                style={copyPhaseStyle(copyPhase)}
              >
                <dl className="text-muted-foreground grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-eyebrow">BPM</dt>
                    <dd className="text-numeric text-foreground mt-0.5 text-sm">
                      {current.bpm ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-eyebrow">Key</dt>
                    <dd className="text-numeric text-foreground mt-0.5 text-sm">
                      {current.musicalKey ?? "—"}
                    </dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between gap-3">
                  {trail.length > 0 ? (
                    <button
                      type="button"
                      disabled={swapping}
                      onClick={goBackInTrail}
                      className={cn(
                        "text-muted-foreground text-sm underline-offset-4",
                        "hover:text-foreground hover:underline",
                        "disabled:pointer-events-none disabled:opacity-40",
                      )}
                    >
                      ← Previous
                    </button>
                  ) : (
                    <span aria-hidden />
                  )}
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link href={`/tracks/${current.id}`}>Track detail</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section aria-labelledby="graph-next-heading" className="min-w-0 space-y-3">
          <div className="motion-safe:animate-in motion-safe:fade-in-0 flex flex-wrap items-center justify-between gap-3 duration-500">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 id="graph-next-heading" className="text-sm font-medium tracking-tight">
                Next transitions
              </h2>
              <span className="text-caption">
                {destinationCount === 1 ? `1 destination` : `${destinationCount} destinations`}
                {transitionCount !== destinationCount ? ` · ${transitionCount} transitions` : null}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={swapping}
              onClick={() => setAdding((value) => !value)}
            >
              {adding ? "Cancel add" : "Add transition"}
            </Button>
          </div>

          {adding ? (
            <AddTransitionPanel
              fromTrackId={current.id}
              excludeTrackId={current.id}
              onCancel={() => setAdding(false)}
              onCreated={async () => {
                setAdding(false);
                await refreshNeighborhood();
              }}
            />
          ) : null}

          {neighbors.length === 0 ? (
            <div className="border-border bg-surface-1 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 space-y-3 rounded-2xl border border-dashed px-5 py-10 text-center duration-500">
              <p className="text-card-title">No outbound transitions yet</p>
              <p className="text-body text-muted-foreground mx-auto max-w-sm">
                Add a transition to a library track, or capture a mix note that links this song
                onward.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
                  Add transition
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onExit}>
                  Choose another track
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/add">Add a track</Link>
                </Button>
              </div>
            </div>
          ) : (
            <ul key={current.id} className="space-y-2">
              {neighbors.map((neighbor, index) => {
                const rowKey = neighbor.id;
                const expanded = expandedKey === rowKey;
                return (
                  <NeighborCard
                    key={rowKey}
                    neighbor={neighbor}
                    expanded={expanded}
                    index={index}
                    panelId={`${baseId}-${rowKey}`}
                    registerRef={(element) => {
                      if (element) cardRefs.current.set(rowKey, element);
                      else cardRefs.current.delete(rowKey);
                    }}
                    onToggle={() => {
                      setExpandedKey(expanded ? null : rowKey);
                      if (!expanded) void loadNeighborhood(neighbor.id).catch(() => null);
                    }}
                    onPrefetch={() => void loadNeighborhood(neighbor.id).catch(() => null)}
                    onChoose={() => void goToTrack(neighbor.id, cardRefs.current.get(rowKey))}
                    onNeighborhoodChange={refreshNeighborhood}
                    fadingOut={swapping && choosingId !== neighbor.id}
                    choosing={choosingId === neighbor.id}
                  />
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
