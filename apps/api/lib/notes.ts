import { listNoteSongLinks, type Note, type NoteSongLink } from "@selecta/db";
import { getSongById, type SongDetail } from "@selecta/graph";

export type SerializedSongSummary = {
  id: string;
  title: string;
  artists: Array<{ id: string; name: string; nameNormalized: string }>;
  artworkUrl: string | null;
};

export type SerializedNoteSongLink = {
  id: string;
  songId: string;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  song: SerializedSongSummary | null;
};

export type SerializedNote = {
  id: string;
  rawText: string;
  status: Note["status"];
  extraction: Note["extraction"];
  model: string | null;
  promptVersion: string | null;
  rawResponse: Note["rawResponse"];
  createdAt: string;
  updatedAt: string;
  songLinks?: SerializedNoteSongLink[];
};

function serializeSongSummary(detail: SongDetail): SerializedSongSummary {
  return {
    id: detail.song.id,
    title: detail.song.title,
    artists: detail.artists,
    artworkUrl: detail.song.artworkUrl,
  };
}

export function serializeNote(note: Note, songLinks?: SerializedNoteSongLink[]): SerializedNote {
  return {
    id: note.id,
    rawText: note.rawText,
    status: note.status,
    extraction: note.extraction,
    model: note.model,
    promptVersion: note.promptVersion,
    rawResponse: note.rawResponse,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    ...(songLinks !== undefined ? { songLinks } : {}),
  };
}

export function serializeNoteSongLink(
  link: NoteSongLink,
  song: SerializedSongSummary | null,
): SerializedNoteSongLink {
  return {
    id: link.id,
    songId: link.songId,
    role: link.role,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    song,
  };
}

/** Resolve manual links and attach Neo4j song summaries when available. */
export async function loadSerializedSongLinks(noteId: string): Promise<SerializedNoteSongLink[]> {
  const links = await listNoteSongLinks(noteId);
  return Promise.all(
    links.map(async (link) => {
      let song: SerializedSongSummary | null = null;
      try {
        const detail = await getSongById(link.songId);
        song = detail ? serializeSongSummary(detail) : null;
      } catch (error) {
        console.error(`failed to resolve song ${link.songId} for note ${noteId}`, error);
        song = null;
      }
      return serializeNoteSongLink(link, song);
    }),
  );
}
