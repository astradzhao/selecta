"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

import { Badge } from "@selecta/ui/components/badge";
import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { ApiClientError } from "@/lib/api/client";
import {
  getTrackNeighborhood,
  type ApiNeighborhoodCurrent,
  type ApiNeighborhoodNeighbor,
  type ApiTransitionEdge,
} from "@/lib/tracks/api";

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

function Artwork({
  url,
  size,
  className,
}: {
  url: string | null;
  size: number;
  className?: string;
}) {
  return (
    <div
      className={cn("bg-muted relative shrink-0 overflow-hidden rounded-2xl", className)}
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image src={url} alt="" fill className="object-cover" sizes={`${size}px`} />
      ) : (
        <div className="text-muted-foreground/40 flex h-full w-full items-center justify-center text-xs tracking-[0.14em] uppercase">
          No art
        </div>
      )}
    </div>
  );
}

/** Beat/bar markers when from/to bars exist — honest to stored metadata only. */
function BarStrip({ transition }: { transition: ApiTransitionEdge }) {
  const fromBar = transition.fromBar;
  const toBar = transition.toBar;
  if (fromBar == null && toBar == null && transition.barsOverlap == null) {
    return null;
  }

  const maxBar = Math.max(fromBar ?? 0, toBar ?? 0, 16);
  const ticks = Math.min(32, Math.max(8, Math.ceil(maxBar / 4) * 4));

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">Bars</p>
      <div
        className="border-border bg-muted/40 relative flex h-10 items-end gap-px overflow-hidden rounded-lg border px-1.5 py-1.5"
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
                "min-w-0 flex-1 rounded-sm transition-colors",
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
      <p className="text-muted-foreground font-mono text-xs">
        {[
          fromBar != null ? `out ${fromBar}` : null,
          toBar != null ? `in ${toBar}` : null,
          transition.barsOverlap != null ? `overlap ${transition.barsOverlap}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </div>
  );
}

/**
 * Preference meters from real transition fields only.
 * EQ bars are illustrative placeholders — we do not invent analytics.
 */
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
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">Preference</p>
        <div className="space-y-2">
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
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs tracking-[0.14em] uppercase">
          EQ (illustrative)
        </p>
        <div
          className="border-border bg-muted/30 flex h-16 items-end justify-between gap-1 rounded-lg border px-3 py-2"
          role="img"
          aria-label="Illustrative EQ placeholder — no measured EQ data on this transition"
        >
          {[0.35, 0.55, 0.7, 0.45, 0.6, 0.4, 0.5].map((height, index) => (
            <div
              key={index}
              className="bg-foreground/15 w-full max-w-2 rounded-sm"
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
        <p className="text-muted-foreground text-[11px]">Placeholder only — no EQ stored yet</p>
      </div>
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
        <span className="font-mono">{valueLabel}</span>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            fill == null ? "bg-foreground/15" : "bg-foreground/70",
          )}
          style={{ width: `${Math.round((fill ?? 0.08) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function CurrentTrackPanel({
  track,
  animating,
}: {
  track: ApiNeighborhoodCurrent;
  animating: boolean;
}) {
  return (
    <section
      aria-labelledby="graph-current-heading"
      className={cn(
        "border-border bg-background sticky top-20 flex flex-col gap-5 rounded-3xl border p-5 sm:p-6",
        "transition-transform duration-300 ease-out",
        animating && "motion-safe:translate-x-1",
      )}
    >
      <div className="space-y-1">
        <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">Now playing</p>
        <h1
          id="graph-current-heading"
          className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
        >
          {track.title}
        </h1>
        <p className="text-muted-foreground text-sm">{artistLine(track.artists)}</p>
      </div>
      <Artwork url={track.artworkUrl} size={220} className="mx-auto w-full max-w-[220px] sm:mx-0" />
      <dl className="text-muted-foreground grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="uppercase tracking-[0.12em]">BPM</dt>
          <dd className="text-foreground mt-0.5 font-mono text-sm">{track.bpm ?? "—"}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em]">Key</dt>
          <dd className="text-foreground mt-0.5 font-mono text-sm">{track.musicalKey ?? "—"}</dd>
        </div>
      </dl>
      <Button asChild variant="outline" size="sm" className="w-fit">
        <Link href={`/tracks/${track.id}`}>Track detail</Link>
      </Button>
    </section>
  );
}

function NeighborCard({
  neighbor,
  expanded,
  onToggle,
  onChoose,
  fadingOut,
  choosing,
  panelId,
}: {
  neighbor: ApiNeighborhoodNeighbor;
  expanded: boolean;
  onToggle: () => void;
  onChoose: () => void;
  fadingOut: boolean;
  choosing: boolean;
  panelId: string;
}) {
  const t = neighbor.transition;
  const technique = formatLabel(t.technique);
  const intent = formatLabel(t.intent);

  return (
    <li
      className={cn(
        "border-border bg-background overflow-hidden rounded-2xl border transition-all duration-300 ease-out",
        fadingOut && "pointer-events-none opacity-0 motion-safe:translate-x-4",
        choosing && "border-foreground/40 shadow-sm",
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          expanded && "bg-muted/30",
        )}
      >
        <Artwork url={neighbor.artworkUrl} size={56} className="rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium tracking-tight">{neighbor.title}</p>
              <p className="text-muted-foreground truncate text-sm">
                {artistLine(neighbor.artists)}
              </p>
            </div>
            {t.quality ? (
              <Badge variant={qualityTone(t.quality)} className="shrink-0 capitalize">
                {t.quality}
              </Badge>
            ) : null}
          </div>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            {[
              t.fromBar != null || t.toBar != null
                ? `Bars ${t.fromBar ?? "—"} → ${t.toBar ?? "—"}`
                : null,
              technique,
              intent,
            ]
              .filter(Boolean)
              .join(" · ") || "Transition details"}
          </p>
        </div>
        <span className="text-muted-foreground mt-1 shrink-0 text-xs" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      <div id={panelId} hidden={!expanded} className="border-border space-y-4 border-t px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {technique ? <Badge variant="outline">{technique}</Badge> : null}
          {intent ? <Badge variant="secondary">{intent}</Badge> : null}
          {!technique && !intent && !t.quality ? (
            <span className="text-muted-foreground text-xs">No technique / intent recorded</span>
          ) : null}
        </div>

        {t.notes ? (
          <p className="text-sm leading-relaxed text-pretty">{t.notes}</p>
        ) : (
          <p className="text-muted-foreground text-sm">No free-text notes on this transition.</p>
        )}

        <BarStrip transition={t} />
        <TransitionMeters transition={t} />

        <Button type="button" onClick={onChoose} disabled={choosing} className="w-full sm:w-auto">
          {choosing ? "Moving…" : "Choose this track"}
        </Button>
      </div>
    </li>
  );
}

export function GraphExplorer({ trackId }: { trackId: string }) {
  const router = useRouter();
  const baseId = useId();
  const [current, setCurrent] = useState<ApiNeighborhoodCurrent | null>(null);
  const [neighbors, setNeighbors] = useState<ApiNeighborhoodNeighbor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, startLoad] = useTransition();
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getTrackNeighborhood(trackId);
        if (cancelled) return;
        setCurrent(response.current);
        setNeighbors(response.neighbors);
        setError(null);
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

  function chooseNeighbor(neighbor: ApiNeighborhoodNeighbor) {
    if (choosingId) return;
    setChoosingId(neighbor.id);
    setFading(true);
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduceMotion ? 0 : 280;
    window.setTimeout(() => {
      router.push(`/tracks/${neighbor.id}/graph`);
    }, delay);
  }

  if (pending && !current) {
    return <p className="text-muted-foreground text-sm">Loading neighborhood…</p>;
  }

  if (error || !current) {
    return (
      <div className="space-y-4">
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {error ?? "Track not found."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/library">Back to library</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/tracks/${trackId}`}>Track detail</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
            Graph explorer
          </p>
          <p className="text-muted-foreground max-w-xl text-sm text-pretty">
            Browse outbound transitions from the current track. Expand a neighbor for mix detail,
            then choose it to traverse.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/tracks/${current.id}`}>← Detail</Link>
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.4fr)] lg:gap-8">
        <div className="relative">
          <div
            className="from-foreground/25 via-foreground/10 pointer-events-none absolute top-28 right-[-1.25rem] bottom-28 hidden w-8 bg-gradient-to-r to-transparent lg:block"
            aria-hidden
          />
          <CurrentTrackPanel track={current} animating={Boolean(choosingId)} />
        </div>

        <section aria-labelledby="graph-next-heading" className="min-w-0 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="graph-next-heading" className="text-sm font-medium tracking-tight">
              Next transitions
            </h2>
            <span className="text-muted-foreground font-mono text-xs">{neighbors.length}</span>
          </div>

          {neighbors.length === 0 ? (
            <div className="border-border bg-muted/20 space-y-3 rounded-2xl border border-dashed px-5 py-10 text-center">
              <p className="text-sm font-medium">No outbound transitions yet</p>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm text-pretty">
                Capture a mix note that links this track to another, or pick a different starting
                song from the library.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <Button asChild variant="outline" size="sm">
                  <Link href="/notes">Open notes</Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/library">Browse library</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <ul
                className={cn(
                  "max-h-[min(70vh,40rem)] space-y-2 overflow-y-auto pe-1",
                  "[mask-image:linear-gradient(to_bottom,transparent_0%,black_12px,black_calc(100%-28px),transparent_100%)]",
                  "pb-6 pt-2",
                )}
              >
                {neighbors.map((neighbor) => {
                  const rowKey = neighbor.transition.proposalKey ?? neighbor.id;
                  const expanded = expandedId === rowKey;
                  return (
                    <NeighborCard
                      key={rowKey}
                      neighbor={neighbor}
                      expanded={expanded}
                      panelId={`${baseId}-${rowKey}`}
                      onToggle={() => setExpandedId(expanded ? null : rowKey)}
                      onChoose={() => chooseNeighbor(neighbor)}
                      fadingOut={fading && choosingId !== neighbor.id}
                      choosing={choosingId === neighbor.id}
                    />
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
