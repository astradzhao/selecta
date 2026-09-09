"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@selecta/ui/components/badge";
import { cn } from "@selecta/ui/lib/utils";

import type { SequenceStepTransition } from "@/lib/sequences/types";
import { displayVocab, qualityRankTone } from "@/lib/transitions/vocab-labels";

function barText(value: number | null): { text: string; empty: boolean } {
  if (value == null || !Number.isFinite(value)) return { text: "—", empty: true };
  return { text: String(value), empty: false };
}

function Measure({
  label,
  value,
  align,
}: {
  label: string;
  value: number | null;
  align: "start" | "center" | "end";
}) {
  const measure = barText(value);
  return (
    <div
      className={cn(
        "min-w-0",
        align === "start" && "text-left",
        align === "center" && "text-center",
        align === "end" && "text-right",
      )}
    >
      <dt className="text-eyebrow">{label}</dt>
      <dd
        className={cn(
          "text-numeric text-body mt-1",
          measure.empty && "text-muted-foreground opacity-40",
        )}
      >
        {measure.text}
      </dd>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-eyebrow">{label}</dt>
      <dd className="text-body mt-1">{children}</dd>
    </div>
  );
}

function QualityValue({ quality }: { quality: string | null }) {
  const label = displayVocab(quality);
  if (!label) return <span className="text-muted-foreground">Unrated</span>;
  const tone = qualityRankTone(quality);
  return <Badge variant={tone ?? "tertiary"}>{label}</Badge>;
}

export function MixInspector({ transition }: { transition: SequenceStepTransition }) {
  const technique = displayVocab(transition.technique);
  const intent = displayVocab(transition.intent);
  const notes = transition.notes?.trim() ?? "";

  return (
    <div className="border-border bg-surface-1 rounded-xl border px-3 py-2.5">
      <dl className="grid grid-cols-3 gap-3">
        <Measure label="Cut out" value={transition.fromBar} align="start" />
        <Measure label="Overlap" value={transition.barsOverlap} align="center" />
        <Measure label="Come in" value={transition.toBar} align="end" />
      </dl>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Fact label="Technique">
          {technique ?? <span className="text-muted-foreground">—</span>}
        </Fact>
        <Fact label="Intent">{intent ?? <span className="text-muted-foreground">—</span>}</Fact>
        <Fact label="Quality">
          <QualityValue quality={transition.quality} />
        </Fact>
      </dl>
      {notes ? (
        <section className="mt-3 space-y-1.5">
          <h3 className="text-eyebrow">Notes</h3>
          <p className="text-body text-pretty whitespace-pre-wrap">{notes}</p>
        </section>
      ) : null}
      <p className="mt-3">
        <Link
          href={`/library/transitions/${transition.id}`}
          className="text-caption text-brand underline-offset-4 hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          Open in library
        </Link>
      </p>
    </div>
  );
}
