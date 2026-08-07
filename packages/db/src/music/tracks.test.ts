import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { isPostgresConfigured } from "../client";
import { normalizeName } from "./normalize";
import { createTrack, getTrackByExternalId, listTracks } from "./tracks";
import { ensureArtist, ensureFolder } from "./vocab";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(packageRoot, "../..");
for (const file of [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")]) {
  if (existsSync(file)) {
    config({ path: file, quiet: true });
    break;
  }
}

const pgReady = isPostgresConfigured();

describe("normalizeName", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    assert.equal(normalizeName("  Skrillex   "), "skrillex");
    assert.equal(normalizeName("Melodic   House"), "melodic house");
  });
});

describe("music vocab + tracks", { skip: !pgReady }, () => {
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

  it("createTrack rounds fractional durationSec for integer column", async () => {
    const suffix = randomUUID().slice(0, 8);
    const created = await createTrack({
      title: `Duration ${suffix}`,
      artists: [`Artist ${suffix}`],
      durationSec: 141.12,
      externalIds: { spotify: `dur-${suffix}` },
    });
    assert.equal(created.created, true);
    assert.equal(created.track.durationSec, 141);
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
});
