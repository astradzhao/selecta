import type { CatalogTrack } from "@/lib/catalog/types";
import type { ApiTrack } from "@/lib/tracks/types";

export type EndpointSelection =
  | { kind: "library"; track: ApiTrack }
  | { kind: "catalog"; track: CatalogTrack };

function libraryProviderIds(track: ApiTrack): Set<string> {
  return new Set(Object.values(track.externalIds).filter(Boolean));
}

/** True when both picks are the same library row, the same catalog id, or a catalog hit of a library row. */
export function sameEndpoint(
  left: EndpointSelection | null | undefined,
  right: EndpointSelection | null | undefined,
): boolean {
  if (!left || !right) return false;
  if (left.kind === "library" && right.kind === "library") {
    return left.track.id === right.track.id;
  }
  if (left.kind === "catalog" && right.kind === "catalog") {
    return (
      left.track.provider === right.track.provider &&
      left.track.providerId === right.track.providerId
    );
  }
  if (left.kind === "library" && right.kind === "catalog") {
    return libraryProviderIds(left.track).has(right.track.providerId);
  }
  if (left.kind === "catalog" && right.kind === "library") {
    return libraryProviderIds(right.track).has(left.track.providerId);
  }
  return false;
}

export function catalogAlreadyInLibrary(
  catalog: CatalogTrack,
  libraryTracks: readonly ApiTrack[],
): boolean {
  return libraryTracks.some((track) => libraryProviderIds(track).has(catalog.providerId));
}
