"use client";

import { Input } from "@selecta/ui/components/input";
import { Textarea } from "@selecta/ui/components/textarea";

import { FormField } from "@/components/common/form-field";
import { optionalNumber, optionalNumberError } from "@/lib/format";

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

export type TransitionFieldErrors = Partial<Record<keyof TransitionFieldValues, string>>;

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
  | { ok: false; error: string; fields: TransitionFieldErrors } {
  const fields: TransitionFieldErrors = {};
  const fromBarError = optionalNumberError(form.fromBar);
  const toBarError = optionalNumberError(form.toBar);
  const overlapError = optionalNumberError(form.barsOverlap);
  if (fromBarError) fields.fromBar = fromBarError;
  if (toBarError) fields.toBar = toBarError;
  if (overlapError) fields.barsOverlap = overlapError;
  if (fromBarError || toBarError || overlapError) {
    return { ok: false, error: "Bar fields must be numbers when set.", fields };
  }
  return {
    ok: true,
    patch: {
      fromBar: optionalNumber(form.fromBar),
      toBar: optionalNumber(form.toBar),
      barsOverlap: optionalNumber(form.barsOverlap),
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
  errors,
  disabled = false,
  compact = false,
}: {
  idPrefix: string;
  values: TransitionFieldValues;
  onChange: (field: keyof TransitionFieldValues, value: string) => void;
  errors?: TransitionFieldErrors;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id={`${idPrefix}-from-bar`} label="From bar" error={errors?.fromBar}>
          <Input
            inputMode="decimal"
            className="text-numeric"
            value={values.fromBar}
            onChange={(event) => onChange("fromBar", event.target.value)}
            disabled={disabled}
          />
        </FormField>
        <FormField id={`${idPrefix}-to-bar`} label="To bar" error={errors?.toBar}>
          <Input
            inputMode="decimal"
            className="text-numeric"
            value={values.toBar}
            onChange={(event) => onChange("toBar", event.target.value)}
            disabled={disabled}
          />
        </FormField>
        <FormField id={`${idPrefix}-bars-overlap`} label="Overlap" error={errors?.barsOverlap}>
          <Input
            inputMode="decimal"
            className="text-numeric"
            value={values.barsOverlap}
            onChange={(event) => onChange("barsOverlap", event.target.value)}
            disabled={disabled}
          />
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id={`${idPrefix}-technique`} label="Technique" error={errors?.technique}>
          <Input
            value={values.technique}
            onChange={(event) => onChange("technique", event.target.value)}
            disabled={disabled}
          />
        </FormField>
        <FormField id={`${idPrefix}-intent`} label="Intent" error={errors?.intent}>
          <Input
            value={values.intent}
            onChange={(event) => onChange("intent", event.target.value)}
            disabled={disabled}
          />
        </FormField>
        <FormField id={`${idPrefix}-quality`} label="Quality" error={errors?.quality}>
          <Input
            value={values.quality}
            onChange={(event) => onChange("quality", event.target.value)}
            disabled={disabled}
          />
        </FormField>
      </div>

      <FormField id={`${idPrefix}-notes`} label="Notes" error={errors?.notes}>
        <Textarea
          value={values.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          className={compact ? "min-h-20" : "min-h-28"}
          disabled={disabled}
        />
      </FormField>
    </div>
  );
}
