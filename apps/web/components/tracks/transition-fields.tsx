"use client";

import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { Textarea } from "@selecta/ui/components/textarea";

import { optionalNumber } from "@/lib/format";

/** Compact editable fields shared by Library detail and Graph inline panel. */
export type TransitionFieldValues = {
  fromBar: string;
  toBar: string;
  barsOverlap: string;
  technique: string;
  intent: string;
  quality: string;
  notes: string;
};

export function emptyTransitionFields(): TransitionFieldValues {
  return {
    fromBar: "",
    toBar: "",
    barsOverlap: "",
    technique: "",
    intent: "",
    quality: "",
    notes: "",
  };
}

export function transitionFieldsFromEdge(edge: {
  fromBar: number | null;
  toBar: number | null;
  barsOverlap: number | null;
  technique: string | null;
  intent: string | null;
  quality: string | null;
  notes: string | null;
}): TransitionFieldValues {
  return {
    fromBar: edge.fromBar != null ? String(edge.fromBar) : "",
    toBar: edge.toBar != null ? String(edge.toBar) : "",
    barsOverlap: edge.barsOverlap != null ? String(edge.barsOverlap) : "",
    technique: edge.technique ?? "",
    intent: edge.intent ?? "",
    quality: edge.quality ?? "",
    notes: edge.notes ?? "",
  };
}

export function parseTransitionFieldPatch(form: TransitionFieldValues):
  | {
      ok: true;
      patch: {
        fromBar: number | null;
        toBar: number | null;
        barsOverlap: number | null;
        technique: string | null;
        intent: string | null;
        quality: string | null;
        notes: string | null;
      };
    }
  | { ok: false; error: string } {
  const fromBar = optionalNumber(form.fromBar);
  const toBar = optionalNumber(form.toBar);
  const barsOverlap = optionalNumber(form.barsOverlap);
  if ([fromBar, toBar, barsOverlap].some((value) => Number.isNaN(value))) {
    return { ok: false, error: "Bar fields must be numbers when set." };
  }
  return {
    ok: true,
    patch: {
      fromBar,
      toBar,
      barsOverlap,
      technique: form.technique.trim() || null,
      intent: form.intent.trim() || null,
      quality: form.quality.trim() || null,
      notes: form.notes.trim() || null,
    },
  };
}

export function TransitionFields({
  idPrefix,
  values,
  onChange,
  disabled = false,
  compact = false,
}: {
  idPrefix: string;
  values: TransitionFieldValues;
  onChange: (field: keyof TransitionFieldValues, value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-from-bar`}>From bar</Label>
          <Input
            id={`${idPrefix}-from-bar`}
            inputMode="decimal"
            className="text-numeric"
            value={values.fromBar}
            onChange={(event) => onChange("fromBar", event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-to-bar`}>To bar</Label>
          <Input
            id={`${idPrefix}-to-bar`}
            inputMode="decimal"
            className="text-numeric"
            value={values.toBar}
            onChange={(event) => onChange("toBar", event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-bars-overlap`}>Overlap</Label>
          <Input
            id={`${idPrefix}-bars-overlap`}
            inputMode="decimal"
            className="text-numeric"
            value={values.barsOverlap}
            onChange={(event) => onChange("barsOverlap", event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-technique`}>Technique</Label>
          <Input
            id={`${idPrefix}-technique`}
            value={values.technique}
            onChange={(event) => onChange("technique", event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-intent`}>Intent</Label>
          <Input
            id={`${idPrefix}-intent`}
            value={values.intent}
            onChange={(event) => onChange("intent", event.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-quality`}>Quality</Label>
          <Input
            id={`${idPrefix}-quality`}
            value={values.quality}
            onChange={(event) => onChange("quality", event.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={values.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          className={compact ? "min-h-20" : "min-h-28"}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
