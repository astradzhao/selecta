import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, it } from "node:test";

import { getDb } from "../client";
import { addNoteTrackLink, listNoteTrackLinks } from "../note-track-links";
import { createNote, getNoteById, upsertTransitionCommit } from "../notes";
import { noteTransitionCommits, trackArtists, trackExternalIds, transitions } from "../schema";
import { isDbIntegrationEnabled } from "../test-env";
import { normalizeName } from "./normalize";
import {
  createTrack,
  deleteTrackById,
  getTrackByExternalId,
  getTrackById,
  listTracks,
  updateTrackById,
} from "./tracks";
import { createTransition, getTransitionById } from "./transitions";
import { ensureArtist, ensureFolder, ensureSubgenre, listFolders, listSubgenres } from "./vocab";

const pgIntegration = isDbIntegrationEnabled();

describe("normalizeName", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    assert.equal(normalizeName("  Skrillex   "), "skrillex");
    assert.equal(normalizeName("Melodic   House"), "melodic house");
  });
});

describe("music vocab + tracks", { skip: !pgIntegration }, () => {
  it("ensureArtist is idempotent on name_normalized", async () => {
    const suffix = randomUUID().slice(0, 8);
    const first = await ensureArtist(`  Skrillex ${suffix}  `);
    const second = await ensureArtist(`skrillex ${suffix}`);
    assert.equal(first.id, second.id);
    assert.equal(first.nameNormalized, `skrillex ${suffix}`);
    // Display name is not updated on conflict.
    assert.equal(second.name, first.name);
  });

  it("ensureFolder coalesces kind on conflict", async () => {
    const suffix = randomUUID().slice(0, 8);
    const name = `Set ${suffix}`;
    const first = await ensureFolder({ name, kind: undefined });
    assert.equal(first.kind, null);
    const second = await ensureFolder({ name, kind: "playlist" });
    assert.equal(second.id, first.id);
    assert.equal(second.kind, "playlist");
    const third = await ensureFolder({ name, kind: undefined });
    assert.equal(third.kind, "playlist");
  });

  it("createTrack dedupes by external id and merges metadata", async () => {
    const suffix = randomUUID().slice(0, 8);
    const spotifyId = `ext-${suffix}`;
    const first = await createTrack({
      title: `Track A ${suffix}`,
      artists: [`Artist ${suffix}`],
      externalIds: { Spotify: spotifyId },
      bpm: 128,
    });
    assert.equal(first.created, true);
    assert.equal(first.track.externalIds.spotify, spotifyId);
    assert.equal(first.track.bpm, 128);

    const second = await createTrack({
      title: `Track B ${suffix}`,
      artists: [`Artist ${suffix}`, `Feature ${suffix}`],
      externalIds: { spotify: spotifyId },
      energy: 0.8,
      genres: [`Bass ${suffix}`],
    });
    assert.equal(second.created, false);
    assert.equal(second.track.id, first.track.id);
    assert.equal(second.track.title, `Track B ${suffix}`);
    assert.equal(second.track.bpm, 128);
    assert.equal(second.track.energy, 0.8);
    assert.ok(second.artists.some((a) => a.name.includes(`Feature ${suffix}`)));
    assert.ok(second.genres.some((g) => g.name.includes(`Bass ${suffix}`)));

    const byExt = await getTrackByExternalId("spotify", spotifyId);
    assert.ok(byExt);
    assert.equal(byExt!.track.id, first.track.id);
  });

  it("createTrack stores fractional durationSec", async () => {
    const suffix = randomUUID().slice(0, 8);
    const created = await createTrack({
      title: `Duration ${suffix}`,
      artists: [`Artist ${suffix}`],
      durationSec: 141.12,
      externalIds: { spotify: `dur-${suffix}` },
    });
    assert.equal(created.created, true);
    assert.ok(created.track.durationSec != null);
    assert.ok(Math.abs(created.track.durationSec - 141.12) < 0.001);
  });

  it("listTracks matches artist query and subgenre by normalized name", async () => {
    const suffix = randomUUID().slice(0, 8);
    const artist = `QueryArtist ${suffix}`;
    const subgenreName = `Melodic  House ${suffix}`;
    await createTrack({
      title: `Quiet Title ${suffix}`,
      artists: [artist],
      subgenres: [{ name: subgenreName }],
    });

    const byArtist = await listTracks({ query: `queryartist ${suffix}`, limit: 20 });
    assert.ok(byArtist.tracks.some((t) => t.track.title.includes(suffix)));

    const bySubgenre = await listTracks({
      subgenre: ` melodic house ${suffix} `,
      limit: 20,
    });
    assert.ok(bySubgenre.tracks.some((t) => t.track.title.includes(suffix)));
  });

  it("updateTrackById patches fields and replaces relation arrays", async () => {
    const suffix = randomUUID().slice(0, 8);
    const spotifyId = `upd-${suffix}`;
    const created = await createTrack({
      title: `Before ${suffix}`,
      artists: [`Old Artist ${suffix}`],
      genres: [`Old Genre ${suffix}`],
      subgenres: [{ name: `Old Sub ${suffix}` }],
      folders: [{ name: `Old Folder ${suffix}`, kind: "folder" }],
      bpm: 120,
      musicalKey: "Am",
      externalIds: { spotify: spotifyId },
    });

    const updated = await updateTrackById(created.track.id, {
      title: `After ${suffix}`,
      artists: [`New Artist ${suffix}`],
      genres: [],
      subgenres: [{ name: `New Sub ${suffix}` }],
      folders: [{ name: `New Playlist ${suffix}`, kind: "playlist" }],
      bpm: 128,
      energy: 0.7,
    });

    assert.equal(updated.track.id, created.track.id);
    assert.equal(updated.track.title, `After ${suffix}`);
    assert.equal(updated.track.bpm, 128);
    assert.equal(updated.track.musicalKey, "Am");
    assert.equal(updated.track.energy, 0.7);
    assert.equal(updated.track.externalIds.spotify, spotifyId);
    assert.deepEqual(
      updated.artists.map((a) => a.name),
      [`New Artist ${suffix}`],
    );
    assert.equal(updated.genres.length, 0);
    assert.deepEqual(
      updated.subgenres.map((s) => s.name),
      [`New Sub ${suffix}`],
    );
    assert.equal(updated.folders.length, 1);
    assert.equal(updated.folders[0]?.name, `New Playlist ${suffix}`);
    assert.equal(updated.folders[0]?.kind, "playlist");

    // Omitted relations stay when only scalar fields patch.
    const scalarOnly = await updateTrackById(created.track.id, { musicalKey: "Bm" });
    assert.equal(scalarOnly.track.musicalKey, "Bm");
    assert.equal(scalarOnly.artists.length, 1);
    assert.equal(scalarOnly.subgenres.length, 1);

    const byExt = await getTrackByExternalId("spotify", spotifyId);
    assert.ok(byExt);
    assert.equal(byExt!.track.id, created.track.id);
  });

  it("deleteTrackById cascades joins/transitions and preserves submissions", async () => {
    const suffix = randomUUID().slice(0, 8);
    const from = await createTrack({
      title: `Del From ${suffix}`,
      artists: [`Del Artist ${suffix}`],
      subgenres: [{ name: `Del Sub ${suffix}` }],
      externalIds: { spotify: `del-from-${suffix}` },
    });
    const to = await createTrack({
      title: `Del To ${suffix}`,
      artists: [`Del Artist ${suffix}`],
    });

    const edge = await createTransition({
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
      technique: "cut",
    });

    const note = await createNote({ rawText: `DJ-67 delete preserve ${suffix}` });
    await addNoteTrackLink(note.id, { trackId: from.track.id, role: "from" });
    const proposalKey = `dj67:del:${suffix}`;
    await upsertTransitionCommit({
      noteId: note.id,
      extractionVersion: 1,
      proposalKey,
      status: "committed",
      fromTrackId: from.track.id,
      toTrackId: to.track.id,
    });

    const deleted = await deleteTrackById(from.track.id);
    assert.equal(deleted.deleted, true);
    assert.equal(await getTrackById(from.track.id), null);
    assert.equal(await getTransitionById(edge.id), null);
    assert.ok(await getTrackById(to.track.id));

    const db = getDb();
    const artistJoins = await db
      .select()
      .from(trackArtists)
      .where(eq(trackArtists.trackId, from.track.id));
    assert.equal(artistJoins.length, 0);
    const extRows = await db
      .select()
      .from(trackExternalIds)
      .where(eq(trackExternalIds.trackId, from.track.id));
    assert.equal(extRows.length, 0);
    const edgeRows = await db
      .select()
      .from(transitions)
      .where(eq(transitions.fromTrackId, from.track.id));
    assert.equal(edgeRows.length, 0);

    const links = await listNoteTrackLinks(note.id);
    assert.equal(links.length, 0);

    const preservedNote = await getNoteById(note.id);
    assert.ok(preservedNote);
    assert.equal(preservedNote!.id, note.id);

    const [commit] = await db
      .select()
      .from(noteTransitionCommits)
      .where(eq(noteTransitionCommits.proposalKey, proposalKey));
    assert.ok(commit);
    assert.equal(commit.fromTrackId, null);
    assert.equal(commit.toTrackId, to.track.id);
  });

  it("listSubgenres and listFolders return ensured vocab and filter by query", async () => {
    const suffix = randomUUID().slice(0, 8);
    await ensureSubgenre(`Melodic House ${suffix}`);
    await ensureSubgenre(`UKG ${suffix}`);
    await ensureFolder({ name: `Club Set ${suffix}`, kind: "playlist" });

    const subs = await listSubgenres({ query: `melodic ${suffix}`, limit: 20 });
    assert.ok(subs.some((s) => s.name.includes(`Melodic House ${suffix}`)));
    assert.ok(!subs.some((s) => s.name.includes(`UKG ${suffix}`)));

    const folderHits = await listFolders({ query: `club ${suffix}`, limit: 20 });
    assert.equal(folderHits.length, 1);
    assert.equal(folderHits[0]?.kind, "playlist");
  });
});
