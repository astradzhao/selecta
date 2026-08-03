import { CatalogError } from "../errors";
import type { CatalogSearchOptions, CatalogTrack, MusicCatalogProvider } from "../types";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const SEARCH_URL = "https://api.spotify.com/v1/search";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_MARKET = "US";

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SpotifyImage = {
  url: string;
  height: number | null;
  width: number | null;
};

type SpotifySimplifiedArtist = {
  id: string;
  name: string;
};

type SpotifySimplifiedAlbum = {
  name: string;
  release_date?: string;
  images?: SpotifyImage[];
};

/** Minimal track shape from GET /v1/search?type=track. */
export type SpotifySearchTrack = {
  id: string;
  name: string;
  duration_ms: number;
  artists: SpotifySimplifiedArtist[];
  album: SpotifySimplifiedAlbum;
};

type SpotifySearchResponse = {
  tracks?: {
    items: Array<SpotifySearchTrack | null>;
  };
};

type CachedToken = {
  accessToken: string;
  /** Epoch ms when the token should be refreshed. */
  expiresAtMs: number;
};

let cachedToken: CachedToken | null = null;

export type SpotifyCredentials = {
  clientId: string;
  clientSecret: string;
  market: string;
};

export function readSpotifyCredentials(): SpotifyCredentials | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  const market = process.env.SPOTIFY_MARKET?.trim() || DEFAULT_MARKET;
  return { clientId, clientSecret, market };
}

export function isSpotifyConfigured(): boolean {
  return readSpotifyCredentials() !== null;
}

/** Pure mapper — kept exportable for focused regression checks. */
export function normalizeSpotifyTrack(track: SpotifySearchTrack): CatalogTrack {
  const images = track.album.images ?? [];
  // Prefer mid-size artwork when present; otherwise first listed.
  const artwork = images.find((image) => image.height === 300)?.url ?? images[0]?.url ?? null;

  return {
    provider: "spotify",
    providerId: track.id,
    title: track.name,
    artists: track.artists.map((artist) => artist.name).filter(Boolean),
    artworkUrl: artwork,
    durationMs: typeof track.duration_ms === "number" ? track.duration_ms : null,
    releaseDate: track.album.release_date ?? null,
    // Track search does not include genres; artist genres need a separate lookup.
    genres: [],
  };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

async function fetchAccessToken(credentials: SpotifyCredentials): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs > now + 30_000) {
    return cachedToken.accessToken;
  }

  const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString(
    "base64",
  );

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
  } catch (cause) {
    throw new CatalogError("unavailable", "Failed to reach Spotify token endpoint.", {
      provider: "spotify",
      cause,
    });
  }

  if (!response.ok) {
    throw new CatalogError("unavailable", `Spotify token request failed (${response.status}).`, {
      provider: "spotify",
    });
  }

  const body = (await response.json()) as SpotifyTokenResponse;
  if (!body.access_token || typeof body.expires_in !== "number") {
    throw new CatalogError("unavailable", "Spotify token response was malformed.", {
      provider: "spotify",
    });
  }

  cachedToken = {
    accessToken: body.access_token,
    expiresAtMs: now + body.expires_in * 1000,
  };
  return body.access_token;
}

/** Reset cached token (tests / HMR). */
export function clearSpotifyTokenCache(): void {
  cachedToken = null;
}

export function createSpotifyProvider(credentials?: SpotifyCredentials): MusicCatalogProvider {
  const creds = credentials ?? readSpotifyCredentials();
  if (!creds) {
    throw new CatalogError("not_configured", "Spotify client credentials are not configured.", {
      provider: "spotify",
    });
  }

  return {
    id: "spotify",
    async searchTracks(query: string, options?: CatalogSearchOptions): Promise<CatalogTrack[]> {
      const accessToken = await fetchAccessToken(creds);
      const limit = clampLimit(options?.limit);
      const url = new URL(SEARCH_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("type", "track");
      url.searchParams.set("limit", String(limit));
      // Required for client-credentials search to return market-available tracks.
      url.searchParams.set("market", creds.market);

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (cause) {
        throw new CatalogError("unavailable", "Failed to reach Spotify search API.", {
          provider: "spotify",
          cause,
        });
      }

      if (response.status === 401) {
        clearSpotifyTokenCache();
        throw new CatalogError("unavailable", "Spotify rejected the access token.", {
          provider: "spotify",
        });
      }

      if (!response.ok) {
        throw new CatalogError("unavailable", `Spotify search failed (${response.status}).`, {
          provider: "spotify",
        });
      }

      const body = (await response.json()) as SpotifySearchResponse;
      const items = body.tracks?.items ?? [];
      return items
        .filter((item): item is SpotifySearchTrack => item != null && Boolean(item.id))
        .map(normalizeSpotifyTrack);
    },
  };
}
