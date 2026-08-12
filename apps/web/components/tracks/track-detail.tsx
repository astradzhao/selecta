"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@selecta/ui/components/button";
import { Input } from "@selecta/ui/components/input";
import { Label } from "@selecta/ui/components/label";
import { Separator } from "@selecta/ui/components/separator";

import { ApiClientError } from "@/lib/api/client";
import { invalidateLibraryCache } from "@/lib/library-cache";
import { clearGraphSession, getGraphSessionSnapshot } from "@/lib/tracks/graph-session-store";
import { deleteTrack, getTrack, updateTrack, type ApiTrack } from "@/lib/tracks/api";
import { FolderTagEditor, type FolderTag } from "@/components/tracks/folder-tag-editor";
import { TagEditor, type TagItem } from "@/components/tracks/tag-editor";
import { TrackChips } from "@/components/tracks/track-chips";

function formatDuration(sec: number | null): string | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  const total = Math.round(sec);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

type FormState = {
  title: string;
  artistsText: string;
  genres: TagItem[];
  subgenres: TagItem[];
  folders: FolderTag[];
  bpm: string;
  musicalKey: string;
  energy: string;
  durationSec: string;
  releaseDate: string;
  artworkUrl: string;
};

function formFromTrack(track: ApiTrack): FormState {
  return {
    title: track.title,
    artistsText: track.artists.map((artist) => artist.name).join(", "),
    genres: track.genres.map((genre) => ({ name: genre.name })),
    subgenres: track.subgenres.map((item) => ({ name: item.name })),
    folders: track.folders.map((item) => ({
      name: item.name,
      ...(item.kind === "folder" || item.kind === "playlist" ? { kind: item.kind } : {}),
    })),
    bpm: track.bpm != null ? String(track.bpm) : "",
    musicalKey: track.musicalKey ?? "",
    energy: track.energy != null ? String(track.energy) : "",
    durationSec: track.durationSec != null ? String(track.durationSec) : "",
    releaseDate: track.releaseDate ?? "",
    artworkUrl: track.artworkUrl ?? "",
  };
}

function transitionWarning(track: ApiTrack): string {
  const parts: string[] = [];
  if (track.hasOutboundTransitions) parts.push("outbound");
  if (track.hasInboundTransitions) parts.push("inbound");
  if (parts.length === 0) {
    return "This cannot be undone.";
  }
  return `This also deletes related ${parts.join(" and ")} transitions. This cannot be undone.`;
}

export function TrackDetail({ trackId }: { trackId: string }) {
  const router = useRouter();
  const [track, setTrack] = useState<ApiTrack | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoad(async () => {
      try {
        const response = await getTrack(trackId);
        if (cancelled) return;
        setTrack(response.track);
        setForm(formFromTrack(response.track));
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setTrack(null);
        setForm(null);
        setLoadError(err instanceof ApiClientError ? err.message : "Failed to load track.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [trackId]);

  if (loading && !track) {
    return <p className="text-muted-foreground text-sm">Loading track…</p>;
  }

  if (loadError || !track || !form) {
    return (
      <div className="space-y-4">
        <p className="border-border bg-muted/40 rounded-lg border px-3 py-2 text-sm">
          {loadError ?? "Track not found."}
        </p>
        <Button asChild variant="outline">
          <Link href="/library">Back to library</Link>
        </Button>
      </div>
    );
  }

  function onFieldChange(field: keyof FormState, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setSaveError(null);
    setSaveMessage(null);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !track) return;

    const artists = form.artistsText
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!form.title.trim() || artists.length === 0) {
      setSaveError("Title and at least one artist are required.");
      setSaveMessage(null);
      return;
    }

    const bpm = optionalNumber(form.bpm);
    const energy = optionalNumber(form.energy);
    const durationSec = optionalNumber(form.durationSec);
    if ([bpm, energy, durationSec].some((value) => Number.isNaN(value))) {
      setSaveError("BPM, energy, and duration must be numbers when set.");
      setSaveMessage(null);
      return;
    }

    startSave(async () => {
      try {
        const response = await updateTrack(track.id, {
          title: form.title.trim(),
          artists,
          genres: form.genres.map((item) => item.name),
          subgenres: form.subgenres.map((item) => ({ name: item.name })),
          folders: form.folders.map((item) => ({
            name: item.name,
            ...(item.kind ? { kind: item.kind } : {}),
          })),
          bpm,
          musicalKey: form.musicalKey.trim() || null,
          energy,
          durationSec,
          releaseDate: form.releaseDate.trim() || null,
          artworkUrl: form.artworkUrl.trim() || null,
        });
        setTrack(response.track);
        setForm(formFromTrack(response.track));
        invalidateLibraryCache();
        setSaveError(null);
        setSaveMessage("Saved.");
      } catch (err) {
        setSaveMessage(null);
        setSaveError(err instanceof ApiClientError ? err.message : "Failed to save track.");
      }
    });
  }

  function onDelete() {
    if (!track) return;
    const confirmed = window.confirm(`Delete “${track.title}”? ${transitionWarning(track)}`);
    if (!confirmed) return;

    startDelete(async () => {
      try {
        await deleteTrack(track.id);
        invalidateLibraryCache();
        if (getGraphSessionSnapshot().activeId === track.id) {
          clearGraphSession();
        }
        router.push("/library");
        router.refresh();
      } catch (err) {
        setDeleteError(err instanceof ApiClientError ? err.message : "Failed to delete track.");
      }
    });
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="bg-muted relative h-48 w-48 shrink-0 overflow-hidden rounded-2xl">
          {track.artworkUrl ? (
            <Image src={track.artworkUrl} alt="" fill className="object-cover" sizes="192px" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">Track</p>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">{track.title}</h1>
            <p className="text-muted-foreground text-base">
              {track.artists.map((artist) => artist.name).join(", ") || "Unknown artist"}
            </p>
          </div>
          <TrackChips subgenres={track.subgenres} folders={track.folders} />
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/library">Back to library</Link>
            </Button>
            <Button asChild>
              <Link href={`/graph?track=${track.id}`}>Open in graph</Link>
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">External IDs</dt>
          <dd className="mt-1 font-mono text-sm">
            {Object.keys(track.externalIds).length
              ? Object.entries(track.externalIds)
                  .map(([provider, id]) => `${provider}:${id}`)
                  .join(", ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Transitions</dt>
          <dd className="mt-1 text-sm">
            Outbound: {track.hasOutboundTransitions ? "yes" : "no"} · Inbound:{" "}
            {track.hasInboundTransitions ? "yes" : "no"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Duration</dt>
          <dd className="mt-1 text-sm">{formatDuration(track.durationSec) ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">Release</dt>
          <dd className="mt-1 text-sm">{track.releaseDate ?? "—"}</dd>
        </div>
      </dl>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-medium">Edit</h2>
          <p className="text-muted-foreground text-sm">
            Update DJ-owned metadata, Subgenres, and Folders. Provider identity stays read-only.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="track-title">Title</Label>
            <Input
              id="track-title"
              value={form.title}
              onChange={(event) => onFieldChange("title", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="track-artists">Artists</Label>
            <Input
              id="track-artists"
              value={form.artistsText}
              onChange={(event) => onFieldChange("artistsText", event.target.value)}
              placeholder="Comma-separated"
              disabled={saving}
            />
          </div>
        </div>

        <TagEditor
          id="track-genres"
          label="Provider genres"
          hint="Optional catalog-style genre labels."
          placeholder="Add genre, then Enter — or pick one below"
          values={form.genres}
          onChange={(genres) => {
            setForm((current) => (current ? { ...current, genres } : current));
            setSaveError(null);
            setSaveMessage(null);
          }}
          vocab="genres"
        />

        <TagEditor
          id="track-subgenres"
          label="Subgenres"
          hint="DJ musical labels — separate from folders."
          placeholder="Add subgenre, then Enter — or pick one below"
          values={form.subgenres}
          onChange={(subgenres) => {
            setForm((current) => (current ? { ...current, subgenres } : current));
            setSaveError(null);
            setSaveMessage(null);
          }}
          vocab="subgenres"
        />

        <FolderTagEditor
          values={form.folders}
          onChange={(folders) => {
            setForm((current) => (current ? { ...current, folders } : current));
            setSaveError(null);
            setSaveMessage(null);
          }}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="track-bpm">BPM</Label>
            <Input
              id="track-bpm"
              inputMode="decimal"
              value={form.bpm}
              onChange={(event) => onFieldChange("bpm", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="track-key">Key</Label>
            <Input
              id="track-key"
              value={form.musicalKey}
              onChange={(event) => onFieldChange("musicalKey", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="track-energy">Energy</Label>
            <Input
              id="track-energy"
              inputMode="decimal"
              value={form.energy}
              onChange={(event) => onFieldChange("energy", event.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="track-duration">Duration (sec)</Label>
            <Input
              id="track-duration"
              inputMode="decimal"
              value={form.durationSec}
              onChange={(event) => onFieldChange("durationSec", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="track-release">Release date</Label>
            <Input
              id="track-release"
              value={form.releaseDate}
              onChange={(event) => onFieldChange("releaseDate", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="track-artwork">Artwork URL</Label>
            <Input
              id="track-artwork"
              value={form.artworkUrl}
              onChange={(event) => onFieldChange("artworkUrl", event.target.value)}
              disabled={saving}
            />
          </div>
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
          <Button type="submit" disabled={saving || deleting}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link href="/library">Back to library</Link>
          </Button>
        </div>
      </form>

      <section className="border-border space-y-3 border-t pt-8">
        <h2 className="font-medium">Delete</h2>
        <p className="text-muted-foreground max-w-xl text-sm">
          Removes this track and its relationships from the library and graph. Source submissions
          stay intact.
          {track.hasOutboundTransitions || track.hasInboundTransitions
            ? " Related inbound/outbound transitions will also be deleted."
            : null}
        </p>
        {deleteError ? (
          <p className="text-sm" role="alert">
            {deleteError}
          </p>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={deleting || saving}
          onClick={onDelete}
        >
          {deleting ? "Deleting…" : "Delete track"}
        </Button>
      </section>
    </div>
  );
}
