"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@selecta/ui/components/button";
import { Label } from "@selecta/ui/components/label";
import { Textarea } from "@selecta/ui/components/textarea";

import { NoteSongLinks } from "@/components/notes/note-song-links";
import { ApiClientError, getNote, updateNote, type ApiNote, type ApiNoteSongLink } from "@/lib/api";

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function NoteDetail({ noteId }: { noteId: string }) {
  const [note, setNote] = useState<ApiNote | null>(null);
  const [rawText, setRawText] = useState("");
  const [songLinks, setSongLinks] = useState<ApiNoteSongLink[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getNote(noteId);
        if (cancelled) return;
        setNote(response.note);
        setRawText(response.note.rawText);
        setSongLinks(response.note.songLinks ?? []);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setNote(null);
        setLoadError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local notes database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to load note.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const trimmed = rawText.trim();
  const dirty = note != null && rawText !== note.rawText;
  const canSave = dirty && trimmed.length > 0 && !saving;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note) return;
    if (!trimmed) {
      setSaveError("Write something before saving.");
      setSaveMessage(null);
      return;
    }

    startSave(async () => {
      try {
        const response = await updateNote(note.id, { rawText });
        setNote(response.note);
        setRawText(response.note.rawText);
        setSongLinks(response.note.songLinks ?? songLinks);
        setSaveError(null);
        setSaveMessage("Saved.");
      } catch (err) {
        setSaveMessage(null);
        setSaveError(
          err instanceof ApiClientError
            ? err.code === "db_not_configured"
              ? "The local notes database isn’t running. Start the full stack with `pnpm dev`."
              : err.message
            : "Failed to save note. Is the API running?",
        );
      }
    });
  }

  if (loading && !note) {
    return <p className="text-muted-foreground text-sm">Loading note…</p>;
  }

  if (loadError || !note) {
    return (
      <div className="space-y-4">
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {loadError ?? "Note not found."}
        </p>
        <Button asChild variant="outline">
          <Link href="/notes">Back to notes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="border-border space-y-2 border-b pb-6">
        <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
          <Link href="/notes" className="hover:text-foreground transition-colors">
            Notes
          </Link>
          {" / "}
          Detail
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Edit note</h1>
        <p className="text-muted-foreground text-sm">
          Created {formatTimestamp(note.createdAt)}
          {note.updatedAt !== note.createdAt
            ? ` · last edited ${formatTimestamp(note.updatedAt)}`
            : null}
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="note-edit-raw-text">Note</Label>
          <Textarea
            id="note-edit-raw-text"
            value={rawText}
            onChange={(event) => {
              setRawText(event.target.value);
              setSaveError(null);
              setSaveMessage(null);
            }}
            className="min-h-56"
            aria-invalid={Boolean(saveError)}
            disabled={saving}
          />
        </div>

        {saveError ? (
          <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm" role="alert">
            {saveError}
          </p>
        ) : null}
        {saveMessage ? (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {saveMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!canSave}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/notes">Back to notes</Link>
          </Button>
        </div>
      </form>

      <NoteSongLinks
        noteId={note.id}
        initialLinks={songLinks}
        onLinksChange={(next) => {
          setSongLinks(next);
          setNote((current) => (current ? { ...current, songLinks: next } : current));
        }}
      />
    </div>
  );
}
