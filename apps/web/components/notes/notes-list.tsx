"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@selecta/ui/components/button";

import { ApiClientError } from "@/lib/api/client";
import { listNotes, type ApiNote } from "@/lib/notes/api";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function notePreview(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return "Empty note";
  const firstLine = trimmed.split(/\r?\n/, 1)[0] ?? trimmed;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}

export function NotesList() {
  const [notes, setNotes] = useState<ApiNote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startLoad] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await listNotes({ limit: 100 });
        if (cancelled) return;
        setNotes(response.notes);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setNotes([]);
        setError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local notes database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to load notes. Is the API running?",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10">
      <header className="border-border flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Notes</h1>
          <p className="text-muted-foreground max-w-xl text-sm">
            Capture free-form mix notes. Saves are durable immediately; extraction runs
            automatically in the background.
          </p>
        </div>
        <Button asChild>
          <Link href="/notes/new">
            <PlusIcon />
            New note
          </Link>
        </Button>
      </header>

      <section aria-label="Notes">
        <p className="text-muted-foreground mb-3 text-xs" aria-live="polite">
          {pending
            ? "Loading notes…"
            : error
              ? null
              : `${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
        </p>

        {error ? (
          <div className="border-border bg-muted/30 rounded-xl border px-5 py-6">
            <h2 className="font-medium">Notes unavailable</h2>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm">{error}</p>
          </div>
        ) : (
          <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/notes/${note.id}`}
                  className="hover:bg-muted/50 flex flex-col gap-1 px-4 py-3 transition-colors"
                >
                  <p className="line-clamp-2 font-medium text-pretty">
                    {notePreview(note.rawText)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatTimestamp(note.createdAt)}
                    {note.updatedAt !== note.createdAt
                      ? ` · edited ${formatTimestamp(note.updatedAt)}`
                      : null}
                  </p>
                </Link>
              </li>
            ))}
            {!pending && notes.length === 0 ? (
              <li className="flex flex-col items-start gap-3 px-5 py-10">
                <div>
                  <h2 className="font-medium">No notes yet</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Write a raw note to start capturing mix knowledge.
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/notes/new">Write your first note</Link>
                </Button>
              </li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}
