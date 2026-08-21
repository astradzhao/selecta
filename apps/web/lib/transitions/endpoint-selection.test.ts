import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CatalogTrack } from "../catalog/types";
import type { ApiTrack } from "../tracks/types";

import {
  catalogAlreadyInLibrary,
  sameEndpoint,
  type EndpointSelection,
} from "./endpoint-selection";

function libraryTrack(
  id: string,
  extras: Partial<Pick<ApiTrack, "title" | "externalIds">> = {},
): ApiTrack {
  return {
    id,
    title: extras.title ?? id,
    artists: [],
    genres: [],
    subgenres: [],
    folders: [],
    artworkUrl: null,
    durationSec: null,
    releaseDate: null,
    bpm: null,
    musicalKey: null,
    energy: null,
    externalIds: extras.externalIds ?? {},
    libraryId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function catalogTrack(providerId: string, title = providerId): CatalogTrack {
  return {
    provider: "spotify",
    providerId,
    title,
    artists: ["Artist"],
    artworkUrl: null,
    durationMs: null,
    releaseDate: null,
    genres: [],
  };
}

function library(
  id: string,
  extras?: Partial<Pick<ApiTrack, "title" | "externalIds">>,
): EndpointSelection {
  return { kind: "library", track: libraryTrack(id, extras) };
}

function catalog(providerId: string): EndpointSelection {
  return { kind: "catalog", track: catalogTrack(providerId) };
}

describe("sameEndpoint", () => {
  it("is true for the same library id", () => {
    assert.equal(sameEndpoint(library("a"), library("a")), true);
  });

  it("is true for the same catalog provider id", () => {
    assert.equal(sameEndpoint(catalog("sp-1"), catalog("sp-1")), true);
  });

  it("is true when a library track's Spotify id equals a catalog pick", () => {
    assert.equal(
      sameEndpoint(library("a", { externalIds: { spotify: "sp-1" } }), catalog("sp-1")),
      true,
    );
  });

  it("is false across different songs", () => {
    assert.equal(sameEndpoint(library("a"), library("b")), false);
    assert.equal(sameEndpoint(catalog("sp-1"), catalog("sp-2")), false);
    assert.equal(
      sameEndpoint(library("a", { externalIds: { spotify: "sp-1" } }), catalog("sp-2")),
      false,
    );
    assert.equal(sameEndpoint(library("a"), catalog("sp-1")), false);
    assert.equal(sameEndpoint(null, library("a")), false);
  });
});

describe("catalogAlreadyInLibrary", () => {
  it("hides a catalog hit whose provider id is already on a library row", () => {
    assert.equal(
      catalogAlreadyInLibrary(catalogTrack("sp-1"), [
        libraryTrack("a", { externalIds: { spotify: "sp-1" } }),
      ]),
      true,
    );
    assert.equal(catalogAlreadyInLibrary(catalogTrack("sp-1"), [libraryTrack("a")]), false);
  });
});
