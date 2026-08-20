"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Alert } from "@selecta/ui/components/alert";
import { Button } from "@selecta/ui/components/button";
import { Textarea } from "@selecta/ui/components/textarea";

import { FormField } from "@/components/common/form-field";
import { describeApiError } from "@/lib/api/errors";
import { createSubmission } from "@/lib/submissions/api";
import { MAX_SUBMISSION_RAW_BYTES } from "@/lib/submissions/limits";

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib < 10 ? kib.toFixed(1) : Math.round(kib)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}

export function NewSubmissionForm({ backHref }: { backHref: string }) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();
  const trimmed = rawText.trim();
  const byteLength = useMemo(() => utf8ByteLength(trimmed), [trimmed]);
  const overLimit = byteLength > MAX_SUBMISSION_RAW_BYTES;
  const canSave = trimmed.length > 0 && !overLimit && !pending;
  const limitError = overLimit
    ? `Submission exceeds the ${formatBytes(MAX_SUBMISSION_RAW_BYTES)} limit (${formatBytes(byteLength)}). Shorten the text and retry.`
    : null;
  const textError = fieldError ?? limitError;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) {
      setFieldError("Write something before submitting.");
      setSubmitError(null);
      return;
    }
    if (overLimit) {
      setFieldError(null);
      setSubmitError(null);
      return;
    }

    startSave(async () => {
      try {
        const response = await createSubmission({ rawText });
        setFieldError(null);
        setSubmitError(null);
        router.push(`/library/submissions/${response.submission.id}`);
      } catch (err) {
        setSubmitError(
          describeApiError(err, { fallback: "Failed to save submission. Is the API running?" }),
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormField
        id="submission-raw-text"
        label="Transition notes"
        error={textError}
        description={`${formatBytes(byteLength)} / ${formatBytes(MAX_SUBMISSION_RAW_BYTES)}`}
      >
        <Textarea
          value={rawText}
          onChange={(event) => {
            setRawText(event.target.value);
            if (fieldError) setFieldError(null);
            if (submitError) setSubmitError(null);
          }}
          placeholder="e.g. Cut from Track A into Track B around bar 64 with a high-pass…"
          className="min-h-56"
          disabled={pending}
        />
      </FormField>

      {submitError ? <Alert variant="destructive">{submitError}</Alert> : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!canSave}>
          {pending ? "Submitting…" : "Submit"}
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href={backHref}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
