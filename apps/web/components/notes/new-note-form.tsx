"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@selecta/ui/components/button";
import { Label } from "@selecta/ui/components/label";
import { Textarea } from "@selecta/ui/components/textarea";

import { ApiClientError } from "@/lib/api/client";
import { createNote } from "@/lib/notes/api";
import { MAX_SUBMISSION_RAW_BYTES } from "@/lib/notes/limits";

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib < 10 ? kib.toFixed(1) : Math.round(kib)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}

export function NewNoteForm({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();
  const trimmed = rawText.trim();
  const byteLength = useMemo(() => utf8ByteLength(trimmed), [trimmed]);
  const overLimit = byteLength > MAX_SUBMISSION_RAW_BYTES;
  const canSave = trimmed.length > 0 && !overLimit && !pending;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) {
      setError("Write something before submitting.");
      return;
    }
    if (overLimit) {
      setError(
        `Submission exceeds the ${formatBytes(MAX_SUBMISSION_RAW_BYTES)} limit (${formatBytes(byteLength)}). Shorten the text and retry.`,
      );
      return;
    }

    startSave(async () => {
      try {
        const response = await createNote({ rawText });
        setError(null);
        router.push(`/library/submissions/${response.note.id}`);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local submissions database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to save submission. Is the API running?",
        );
      }
    });
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-8"}>
      {embedded ? null : (
        <header className="border-border space-y-2 border-b pb-6">
          <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
            <Link href="/add" className="hover:text-foreground transition-colors">
              Add
            </Link>
            {" / "}
            Transition
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Add transition</h1>
          <p className="text-muted-foreground max-w-xl text-sm">
            Paste or type free-form mix notes. Processing starts in the background after submit.
          </p>
        </header>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="note-raw-text">Transition notes</Label>
          <Textarea
            id="note-raw-text"
            value={rawText}
            onChange={(event) => {
              setRawText(event.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Cut from Track A into Track B around bar 64 with a high-pass…"
            className="min-h-56"
            aria-invalid={Boolean(error) || overLimit}
            disabled={pending}
          />
          <p
            className={overLimit ? "text-destructive text-xs" : "text-muted-foreground text-xs"}
            aria-live="polite"
          >
            {formatBytes(byteLength)} / {formatBytes(MAX_SUBMISSION_RAW_BYTES)}
            {overLimit ? " — too large to submit" : null}
          </p>
        </div>

        {error ? (
          <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!canSave}>
            {pending ? "Submitting…" : "Submit"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/library?view=submissions">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
