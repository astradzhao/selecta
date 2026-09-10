"use client";

import { HOT_CUE_MAX_LENGTH } from "@selecta/library/mix-point";
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
  fromCue: string;
  toCue: string;
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
    fromCue: "",
    toCue: "",
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
  fromCue?: string | null;
  toCue?: string | null;
  barsOverlap: number | null;
  technique: string | null;
  intent: string | null;
  quality: string | null;
  notes: string | null;
}): TransitionFieldValues {
  return {
    fromBar: edge.fromBar != null ? String(edge.fromBar) : "",
    toBar: edge.toBar != null ? String(edge.toBar) : "",
    fromCue: edge.fromCue ?? "",
    toCue: edge.toCue ?? "",
    barsOverlap: edge.barsOverlap != null ? String(edge.barsOverlap) : "",
    technique: edge.technique ?? "",
    intent: edge.intent ?? "",
    quality: edge.quality ?? "",
    notes: edge.notes ?? "",
  };
}

function cueFieldError(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > HOT_CUE_MAX_LENGTH) {
    return `Hot cue must be ${HOT_CUE_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

export function parseTransitionFieldPatch(form: TransitionFieldValues):
  | {
      ok: true;
      patch: {
        fromBar: number | null;
        toBar: number | null;
        fromCue: string | null;
        toCue: string | null;
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
  const fromCueError = cueFieldError(form.fromCue);
  const toCueError = cueFieldError(form.toCue);
  if (fromBarError) fields.fromBar = fromBarError;
  if (toBarError) fields.toBar = toBarError;
  if (overlapError) fields.barsOverlap = overlapError;
  if (fromCueError) fields.fromCue = fromCueError;
  if (toCueError) fields.toCue = toCueError;
  if (fromBarError || toBarError || overlapError || fromCueError || toCueError) {
    return { ok: false, error: "Mix points must be a cue, a bar number, or both.", fields };
  }
  return {
    ok: true,
    patch: {
      fromBar: optionalNumber(form.fromBar),
      toBar: optionalNumber(form.toBar),
      fromCue: form.fromCue.trim() || null,
      toCue: form.toCue.trim() || null,
      barsOverlap: optionalNumber(form.barsOverlap),
      technique: form.technique.trim() || null,
      intent: form.intent.trim() || null,
      quality: form.quality.trim() || null,
      notes: form.notes.trim() || null,
    },
  };
}

function MixEndpointFields({
  idPrefix,
  title,
  description,
  cue,
  bar,
  cueError,
  barError,
  disabled,
  onCue,
  onBar,
}: {
  idPrefix: string;
  title: string;
  description: string;
  cue: string;
  bar: string;
  cueError?: string;
  barError?: string;
  disabled?: boolean;
  onCue: (value: string) => void;
  onBar: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div>
        <p className="text-eyebrow">{title}</p>
        <p className="text-caption mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
        <FormField id={`${idPrefix}-cue`} label="Cue" error={cueError}>
          <Input
            maxLength={HOT_CUE_MAX_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="A"
            value={cue}
            onChange={(event) => onCue(event.target.value)}
            disabled={disabled}
          />
        </FormField>
        <FormField id={`${idPrefix}-bar`} label="Bar" error={barError}>
          <Input
            inputMode="decimal"
            className="text-numeric"
            value={bar}
            onChange={(event) => onBar(event.target.value)}
            disabled={disabled}
          />
        </FormField>
      </div>
    </div>
  );
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
  /** Graph and Library detail keep the stacked mix-point row; the add page places them on the pair. */
  includeBars?: boolean;
}) {
  return (
    <div className={compact ? "space-y-3" : "space-y-6"}>
      {includeBars ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <MixEndpointFields
            idPrefix={`${idPrefix}-from`}
            title="From"
            description="Outgoing — start playing the next track"
            cue={values.fromCue}
            bar={values.fromBar}
            cueError={errors?.fromCue}
            barError={errors?.fromBar}
            disabled={disabled}
            onCue={(value) => onChange("fromCue", value)}
            onBar={(value) => onChange("fromBar", value)}
          />
          <MixEndpointFields
            idPrefix={`${idPrefix}-into`}
            title="Into"
            description="Incoming — where playback begins"
            cue={values.toCue}
            bar={values.toBar}
            cueError={errors?.toCue}
            barError={errors?.toBar}
            disabled={disabled}
            onCue={(value) => onChange("toCue", value)}
            onBar={(value) => onChange("toBar", value)}
          />
          <FormField
            id={`${idPrefix}-bars-overlap`}
            label="Overlap"
            error={errors?.barsOverlap}
            description="Bars together before the outgoing fades"
          >
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
