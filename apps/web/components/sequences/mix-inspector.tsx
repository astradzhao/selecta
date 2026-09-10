"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@selecta/ui/components/badge";
import { cn } from "@selecta/ui/lib/utils";

import { mixPointText } from "@/lib/transitions/mix-point";
import type { SequenceStepTransition } from "@/lib/sequences/types";
import { displayVocab, qualityRankTone } from "@/lib/transitions/vocab-labels";

function MixPointValue({ cue, bar }: { cue: string | null; bar: number | null }) {
  const text = mixPointText(cue, bar);
  const empty = text === "—";
  return (
    <span className={cn("text-numeric text-body", empty && "text-muted-foreground opacity-40")}>
      {text}
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-eyebrow">{label}</dt>
      <dd className="text-body mt-1">{children}</dd>
    </div>
  );
}

function NumberValue({ value }: { value: number | null }) {
  const empty = value == null || !Number.isFinite(value);
  return (
    <span className={cn("text-numeric text-body", empty && "text-muted-foreground opacity-40")}>
      {empty ? "—" : String(value)}
    </span>
  );
}

function FactValue({ children }: { children: ReactNode }) {
  return <span className="text-body">{children}</span>;
}

function QualityValue({ quality }: { quality: string | null }) {
  const label = displayVocab(quality);
  if (!label) return <span className="text-muted-foreground">Unrated</span>;
  const tone = qualityRankTone(quality);
  return <Badge variant={tone ?? "tertiary"}>{label}</Badge>;
}

export function MixInspector({
  open,
  transition,
}: {
  open: boolean;
  transition: SequenceStepTransition;
}) {
  const technique = displayVocab(transition.technique);
  const intent = displayVocab(transition.intent);
  const notes = transition.notes?.trim() ?? "";

  return (
    <div
      inert={!open}
      className={cn(
        "ease-out-soft grid [transition-property:grid-template-rows] [transition-duration:var(--motion-slow)]",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "ease-out-soft pt-1.5 [transition-property:opacity] [transition-duration:var(--motion-slow)]",
            open ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="border-border bg-surface-1 rounded-xl border px-3 py-2.5">
            <dl className="grid grid-cols-3 items-start gap-x-3 gap-y-3">
              <Field label="From">
                <MixPointValue cue={transition.fromCue} bar={transition.fromBar} />
              </Field>
              <Field label="Into">
                <MixPointValue cue={transition.toCue} bar={transition.toBar} />
              </Field>
              <Field label="Overlap">
                <NumberValue value={transition.barsOverlap} />
              </Field>
              <Field label="Technique">
                <FactValue>
                  {technique ?? <span className="text-muted-foreground">—</span>}
                </FactValue>
              </Field>
              <Field label="Intent">
                <FactValue>{intent ?? <span className="text-muted-foreground">—</span>}</FactValue>
              </Field>
              <Field label="Quality">
                <QualityValue quality={transition.quality} />
              </Field>
            </dl>
            {notes ? (
              <section className="border-border mt-3 space-y-1.5 border-t pt-3">
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
        </div>
      </div>
    </div>
  );
}
