"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@selecta/ui/components/button";
import { Label } from "@selecta/ui/components/label";
import { Textarea } from "@selecta/ui/components/textarea";

import { ApiClientError, createNote } from "@/lib/api";

export function NewNoteForm() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();
  const trimmed = rawText.trim();
  const canSave = trimmed.length > 0 && !pending;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) {
      setError("Write something before saving.");
      return;
    }

    startSave(async () => {
      try {
        const response = await createNote({ rawText });
        setError(null);
        router.push(`/notes/${response.note.id}`);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local notes database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to save note. Is the API running?",
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      <header className="border-border space-y-2 border-b pb-6">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
          <Link href="/notes" className="hover:text-foreground transition-colors">
            Notes
          </Link>
          {" / "}
          New
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">New note</h1>
        <p className="text-muted-foreground max-w-xl text-sm">
          Paste or type free-form mix notes. No track selection or AI required.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="note-raw-text">Note</Label>
          <Textarea
            id="note-raw-text"
            value={rawText}
            onChange={(event) => {
              setRawText(event.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Cut from Track A into Track B around bar 64 with a high-pass…"
            className="min-h-56"
            aria-invalid={Boolean(error)}
            disabled={pending}
          />
        </div>

        {error ? (
          <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!canSave}>
            {pending ? "Saving…" : "Save note"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/notes">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
