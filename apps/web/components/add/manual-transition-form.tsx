"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowRightIcon } from "lucide-react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { cn } from "@selecta/ui/lib/utils";

import { TransitionEndpointField } from "@/components/add/transition-endpoint-field";
import { omitFieldError } from "@/components/common/form-field";
import {
  emptyTransitionFields,
  parseTransitionFieldPatch,
  TransitionFields,
  type TransitionFieldErrors,
  type TransitionFieldValues,
} from "@/components/tracks/transition-fields";
import { describeApiError } from "@/lib/api/errors";
import { ApiClientError } from "@/lib/api/client";
import { invalidateLibraryCache } from "@/lib/library-cache";
import { createTrack, getTrack, type ApiTrack } from "@/lib/tracks/api";
import type { CatalogTrack } from "@/lib/catalog/types";
import { createTransition } from "@/lib/transitions/api";
import { sameEndpoint, type EndpointSelection } from "@/lib/transitions/endpoint-selection";

function MeasureInput({
  unit,
  className,
  ...props
}: React.ComponentProps<"input"> & { unit: string }) {
  return (
    <span
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 inline-flex h-8 w-[6.25rem] items-center gap-1 rounded-lg border bg-transparent px-2.5 focus-within:ring-3 dark:bg-input/30",
        className,
      )}
    >
      <input
        className="text-numeric min-w-0 flex-1 bg-transparent text-right text-sm outline-none disabled:cursor-not-allowed"
        {...props}
      />
      <span className="text-caption shrink-0">{unit}</span>
    </span>
  );
}

function BarField({
  id,
  label,
  unit,
  value,
  error,
  disabled,
  onChange,
  align = "start",
  className,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        align === "start" && "justify-self-start text-left",
        align === "center" && "justify-self-center text-center",
        align === "end" && "justify-self-end text-right",
        className,
      )}
    >
      <label htmlFor={id} className="text-caption mb-1.5 block">
        {label}
      </label>
      <MeasureInput
        id={id}
        unit={unit}
        inputMode="decimal"
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
    </div>
  );
}

async function loadPrefillTrack(id: string | undefined): Promise<ApiTrack | null> {
  const trimmed = id?.trim();
  if (!trimmed) return null;
  try {
    const response = await getTrack(trimmed);
    return response.track;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    return null;
  }
}

function catalogBody(track: CatalogTrack) {
  return {
    provider: track.provider,
    providerId: track.providerId,
    title: track.title,
    artists: track.artists,
    artworkUrl: track.artworkUrl,
    durationMs: track.durationMs,
    releaseDate: track.releaseDate,
    genres: track.genres,
  };
}

async function resolveEndpoint(selection: EndpointSelection): Promise<string> {
  if (selection.kind === "library") return selection.track.id;
  const response = await createTrack({ catalog: catalogBody(selection.track) });
  return response.track.id;
}

function saveHint(from: EndpointSelection | null, to: EndpointSelection | null): string | null {
  if (!from && !to) return "Pick both tracks to save.";
  if (!from) return "Pick a “From” track to save.";
  if (!to) return "Pick a “To” track to save.";
  if (sameEndpoint(from, to)) return "From and To must be different songs.";
  return null;
}

export function ManualTransitionForm({
  backHref,
  fromTrackId,
  toTrackId,
}: {
  backHref: string;
  fromTrackId?: string;
  toTrackId?: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState<EndpointSelection | null>(null);
  const [to, setTo] = useState<EndpointSelection | null>(null);
  const [form, setForm] = useState<TransitionFieldValues>(emptyTransitionFields());
  const [fieldErrors, setFieldErrors] = useState<TransitionFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();
  const hint = saveHint(from, to);
  const canSave = from != null && to != null && !sameEndpoint(from, to) && !pending;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [fromTrack, toTrack] = await Promise.all([
        loadPrefillTrack(fromTrackId),
        loadPrefillTrack(toTrackId),
      ]);
      if (cancelled) return;
      if (fromTrack) setFrom({ kind: "library", track: fromTrack });
      if (toTrack) setTo({ kind: "library", track: toTrack });
    })();
    return () => {
      cancelled = true;
    };
  }, [fromTrackId, toTrackId]);

  function updateField(field: keyof TransitionFieldValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => omitFieldError(current, field));
    setError(null);
  }

  function swap() {
    setFrom(to);
    setTo(from);
    setForm((current) => ({
      ...current,
      fromBar: current.toBar,
      toBar: current.fromBar,
    }));
    setFieldErrors((current) => ({
      ...current,
      fromBar: current.toBar,
      toBar: current.fromBar,
    }));
    setError(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!from || !to || sameEndpoint(from, to)) return;
    const parsed = parseTransitionFieldPatch(form);
    if (!parsed.ok) {
      setFieldErrors(parsed.fields);
      setError(null);
      return;
    }

    startSave(async () => {
      try {
        const [fromId, toId] = await Promise.all([resolveEndpoint(from), resolveEndpoint(to)]);
        if (fromId === toId) {
          setError("From and To must be different songs.");
          return;
        }
        const response = await createTransition({
          fromTrackId: fromId,
          toTrackId: toId,
          ...parsed.patch,
        });
        invalidateLibraryCache();
        router.push(`/library/transitions/${response.transition.id}`);
        router.refresh();
      } catch (err) {
        setError(describeApiError(err, { fallback: "Failed to create transition." }));
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div
        className={cn(
          "grid items-start gap-x-4 gap-y-2",
          "grid-cols-1 [grid-template-areas:'from-label'_'from-slot'_'from-bar'_'swap'_'overlap'_'to-label'_'to-slot'_'to-bar']",
          "sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)]",
          "sm:[grid-template-areas:'from-label_._to-label'_'from-slot_swap_to-slot'_'from-bar_overlap_to-bar']",
        )}
      >
        <p className="text-eyebrow [grid-area:from-label]">From</p>
        <p className="text-eyebrow [grid-area:to-label]">To</p>

        <div className="min-w-0 [grid-area:from-slot]">
          <TransitionEndpointField
            id="from-track"
            label="From"
            selected={from}
            opposite={to}
            disabled={pending}
            autoFocus
            onSelect={setFrom}
            onClear={() => setFrom(null)}
          />
        </div>

        <button
          type="button"
          className="text-secondary flex h-14 items-center justify-center disabled:opacity-40 [grid-area:swap]"
          aria-label="Swap from and to"
          disabled={pending || from == null || to == null}
          onClick={swap}
        >
          <span className="bg-secondary-subtle flex size-8 items-center justify-center rounded-full">
            <ArrowRightIcon className="size-4" aria-hidden />
          </span>
        </button>

        <div className="min-w-0 [grid-area:to-slot]">
          <TransitionEndpointField
            id="to-track"
            label="To"
            selected={to}
            opposite={from}
            disabled={pending}
            onSelect={setTo}
            onClear={() => setTo(null)}
          />
        </div>

        <BarField
          id="add-from-bar"
          label="Cut out at"
          unit="bar"
          align="start"
          value={form.fromBar}
          error={fieldErrors.fromBar}
          disabled={pending}
          onChange={(value) => updateField("fromBar", value)}
          className="[grid-area:from-bar]"
        />
        <BarField
          id="add-overlap"
          label="Overlap"
          unit="bars"
          align="center"
          value={form.barsOverlap}
          error={fieldErrors.barsOverlap}
          disabled={pending}
          onChange={(value) => updateField("barsOverlap", value)}
          className="[grid-area:overlap]"
        />
        <BarField
          id="add-to-bar"
          label="Come in at"
          unit="bar"
          align="end"
          value={form.toBar}
          error={fieldErrors.toBar}
          disabled={pending}
          onChange={(value) => updateField("toBar", value)}
          className="[grid-area:to-bar]"
        />
      </div>

      <div className="border-border space-y-3 border-t pt-5">
        <p className="text-eyebrow">Mix</p>
        <TransitionFields
          idPrefix="add-transition"
          values={form}
          errors={fieldErrors}
          disabled={pending}
          includeBars={false}
          onChange={updateField}
        />
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <div className="border-border flex flex-wrap items-center justify-end gap-3 border-t pt-4">
        {hint ? <p className="text-caption me-auto">{hint}</p> : null}
        <Button asChild type="button" variant="outline">
          <Link href={backHref}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={!canSave}>
          {pending ? "Saving…" : "Create transition"}
        </Button>
      </div>
    </form>
  );
}
