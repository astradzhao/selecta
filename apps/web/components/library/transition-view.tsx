import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";

import { Badge } from "@selecta/ui/components/badge";
import { Separator } from "@selecta/ui/components/separator";
import { cn } from "@selecta/ui/lib/utils";

import { artistLine, formatTimestamp } from "@/lib/format";
import { formatBpmKey } from "@/lib/tracks/crate-row";
import { EMPTY_SHIFT, formatBpmShift, formatKeyShift } from "@/lib/transitions/transition-row";
import type { ApiTransition, ApiTransitionEndpoint } from "@/lib/transitions/types";
import { displayVocab, qualityRankTone } from "@/lib/transitions/vocab-labels";

const ART_PX = 192;

function barLabel(value: number | null): { text: string; empty: boolean } {
  if (value == null || !Number.isFinite(value)) return { text: "—", empty: true };
  return { text: String(value), empty: false };
}

function SleeveArt({ url }: { url: string | null }) {
  return (
    <div className="bg-muted ring-border relative size-24 shrink-0 overflow-hidden rounded-2xl ring-1 ring-inset sm:size-48">
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          className="object-cover"
          sizes={`(min-width: 640px) ${ART_PX}px, 96px`}
        />
      ) : (
        <span className="text-eyebrow text-muted-foreground flex h-full w-full items-center justify-center">
          No art
        </span>
      )}
    </div>
  );
}

function SleeveMeta({
  side,
  track,
  align,
}: {
  side: "From" | "To";
  track: ApiTransitionEndpoint;
  align: "start" | "end";
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", align === "end" && "sm:text-right")}>
      <p className="text-eyebrow">{side}</p>
      <h2 className="text-section-title group-hover:text-brand duration-fast text-balance transition-colors">
        {track.title}
      </h2>
      <p className="text-body text-muted-foreground">{artistLine(track.artists)}</p>
      <p className="text-crate-meta">{formatBpmKey(track.bpm, track.musicalKey)}</p>
    </div>
  );
}

function MixShift({ from, to }: { from: ApiTransitionEndpoint; to: ApiTransitionEndpoint }) {
  const bpm = formatBpmShift(from.bpm, to.bpm);
  const key = formatKeyShift(from.musicalKey, to.musicalKey);
  if (bpm === EMPTY_SHIFT && key === EMPTY_SHIFT) return null;

  return (
    <p className="text-crate-meta text-center">
      <span className={cn("block", bpm === EMPTY_SHIFT && "opacity-40")}>{bpm}</span>
      <span className={cn("block", key === EMPTY_SHIFT && "opacity-40")}>{key}</span>
    </p>
  );
}

function PhraseMeasure({
  label,
  value,
  unit,
  align,
}: {
  label: string;
  value: number | null;
  unit: string;
  align: "start" | "center" | "end";
}) {
  const measure = barLabel(value);
  return (
    <div
      className={cn(
        "min-w-0",
        align === "start" && "text-left",
        align === "center" && "text-center",
        align === "end" && "text-right",
      )}
    >
      <p className="text-eyebrow">{label}</p>
      <p
        className={cn(
          "text-section-title text-numeric mt-1.5",
          measure.empty && "text-muted-foreground opacity-40",
        )}
      >
        {measure.text}
      </p>
      <p className="text-caption mt-0.5">{unit}</p>
    </div>
  );
}

function MixFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-eyebrow">{label}</dt>
      <dd className="text-body mt-1.5">{children}</dd>
    </div>
  );
}

function QualityValue({ quality }: { quality: string | null }) {
  const label = displayVocab(quality);
  if (!label) return <span className="text-muted-foreground">Unrated</span>;
  const tone = qualityRankTone(quality);
  return <Badge variant={tone ?? "tertiary"}>{label}</Badge>;
}

export function TransitionView({ transition }: { transition: ApiTransition }) {
  const technique = displayVocab(transition.technique);
  const intent = displayVocab(transition.intent);
  const updated = transition.updatedAt !== transition.createdAt;
  const from = transition.fromTrack;
  const to = transition.toTrack;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">
        {from.title} into {to.title}
      </h1>

      <section aria-label="Mix pair" className="space-y-4 sm:space-y-0">
        <div className="flex flex-col gap-4 sm:hidden">
          <Link href={`/tracks/${from.id}`} className="group flex min-w-0 gap-4">
            <SleeveArt url={from.artworkUrl} />
            <SleeveMeta side="From" track={from} align="start" />
          </Link>
          <div className="flex justify-center">
            <span className="bg-brand-subtle text-brand flex size-10 items-center justify-center rounded-full">
              <ArrowDownIcon className="size-4" aria-hidden />
              <span className="sr-only">into</span>
            </span>
          </div>
          <Link href={`/tracks/${to.id}`} className="group flex min-w-0 gap-4">
            <SleeveArt url={to.artworkUrl} />
            <SleeveMeta side="To" track={to} align="start" />
          </Link>
        </div>

        <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-start sm:gap-x-6">
          <Link href={`/tracks/${from.id}`} className="group flex min-w-0 flex-col items-end gap-4">
            <SleeveArt url={from.artworkUrl} />
            <SleeveMeta side="From" track={from} align="end" />
          </Link>
          <div className="flex flex-col items-center">
            <div className="flex h-48 items-center">
              <span className="bg-brand-subtle text-brand flex size-10 items-center justify-center rounded-full">
                <ArrowRightIcon className="size-4" aria-hidden />
                <span className="sr-only">into</span>
              </span>
            </div>
            <MixShift from={from} to={to} />
          </div>
          <Link href={`/tracks/${to.id}`} className="group flex min-w-0 flex-col items-start gap-4">
            <SleeveArt url={to.artworkUrl} />
            <SleeveMeta side="To" track={to} align="start" />
          </Link>
        </div>
      </section>

      <section
        aria-label="Bars"
        className="border-border bg-surface-1 grid grid-cols-3 gap-3 rounded-xl border px-4 py-4 sm:px-6"
      >
        <PhraseMeasure label="Cut out at" value={transition.fromBar} unit="bar" align="start" />
        <PhraseMeasure label="Overlap" value={transition.barsOverlap} unit="bars" align="center" />
        <PhraseMeasure label="Come in at" value={transition.toBar} unit="bar" align="end" />
      </section>

      <dl className="grid gap-6 sm:grid-cols-3">
        <MixFact label="Technique">
          {technique ?? <span className="text-muted-foreground">—</span>}
        </MixFact>
        <MixFact label="Intent">
          {intent ?? <span className="text-muted-foreground">—</span>}
        </MixFact>
        <MixFact label="Quality">
          <QualityValue quality={transition.quality} />
        </MixFact>
      </dl>

      {transition.notes?.trim() ? (
        <section className="space-y-2">
          <h2 className="text-eyebrow">Notes</h2>
          <div className="border-border bg-surface-1 rounded-xl border px-4 py-3">
            <p className="text-body text-pretty whitespace-pre-wrap">{transition.notes.trim()}</p>
          </div>
        </section>
      ) : null}

      <Separator />

      <dl className="grid gap-6 sm:grid-cols-2">
        <MixFact label="Source">
          {transition.sourceSubmissionId ? (
            <Link
              href={`/library/submissions/${transition.sourceSubmissionId}`}
              className="text-brand underline-offset-4 hover:underline"
            >
              Source submission
            </Link>
          ) : (
            "Manual"
          )}
          {transition.confidence != null && Number.isFinite(transition.confidence) ? (
            <span className="text-crate-meta">
              {" "}
              · {Math.round(transition.confidence * 100)}% confidence
            </span>
          ) : null}
        </MixFact>
        <MixFact label="Created">
          <span className="text-numeric">
            {formatTimestamp(transition.createdAt)}
            {updated ? ` · updated ${formatTimestamp(transition.updatedAt)}` : null}
          </span>
        </MixFact>
      </dl>
    </div>
  );
}
