"use client";

import { Combobox } from "@selecta/ui/components/combobox";
import { Field, FieldError, FieldTitle } from "@selecta/ui/components/field";
import { Input } from "@selecta/ui/components/input";
import { Segmented } from "@selecta/ui/components/segmented";
import { Textarea } from "@selecta/ui/components/textarea";

import { FormField } from "@/components/common/form-field";
import { optionalNumber, optionalNumberError } from "@/lib/format";
import {
  INTENT_OPTIONS,
  QUALITY_OPTIONS,
  qualityRankTone,
  TECHNIQUE_OPTIONS,
} from "@/lib/transitions/vocab-labels";

const QUALITY_SEGMENTED_OPTIONS = QUALITY_OPTIONS.map((option) => ({
  ...option,
  tone: qualityRankTone(option.value) ?? undefined,
}));

/** Compact editable fields shared by Library detail, Graph, and Add. */
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
  includeBars = true,
}: {
  idPrefix: string;
  values: TransitionFieldValues;
  onChange: (field: keyof TransitionFieldValues, value: string) => void;
  errors?: TransitionFieldErrors;
  disabled?: boolean;
  compact?: boolean;
  /** Graph and Library detail keep the stacked bar row; the add page places bars on the pair. */
  includeBars?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      {includeBars ? (
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
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id={`${idPrefix}-technique`} label="Technique" error={errors?.technique}>
          <Combobox
            value={values.technique}
            onChange={(next) => onChange("technique", next)}
            options={TECHNIQUE_OPTIONS}
            disabled={disabled}
          />
        </FormField>
        <FormField id={`${idPrefix}-intent`} label="Intent" error={errors?.intent}>
          <Combobox
            value={values.intent}
            onChange={(next) => onChange("intent", next)}
            options={INTENT_OPTIONS}
            disabled={disabled}
            placeholder="Build hype, cool down…"
          />
        </FormField>
        <Field data-invalid={errors?.quality ? true : undefined}>
          <FieldTitle id={`${idPrefix}-quality-label`}>Quality</FieldTitle>
          <Segmented
            aria-labelledby={`${idPrefix}-quality-label`}
            value={values.quality}
            onChange={(next) => onChange("quality", next)}
            options={QUALITY_SEGMENTED_OPTIONS}
            disabled={disabled}
          />
          {errors?.quality ? (
            <FieldError id={`${idPrefix}-quality-error`}>{errors.quality}</FieldError>
          ) : null}
        </Field>
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
