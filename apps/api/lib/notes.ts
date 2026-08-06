import { listNoteTrackLinks, type Note, type NoteTrackLink } from "@selecta/db";
import { getTrackById, type TrackDetail } from "@selecta/graph";

export type SerializedTrackSummary = {
  id: string;
  title: string;
  artists: Array<{ id: string; name: string; nameNormalized: string }>;
  artworkUrl: string | null;
};

export type SerializedNoteTrackLink = {
  id: string;
  trackId: string;
  role: string | null;
  createdAt: string;
  updatedAt: string;
  track: SerializedTrackSummary | null;
};

export type SerializedNote = {
  id: string;
  rawText: string;
  extractionStatus: Note["extractionStatus"];
  extractionVersion: number;
  extractionError: string | null;
  extractionConfidence: number | null;
  extractionStartedAt: string | null;
  extractionFinishedAt: string | null;
  extraction: Note["extraction"];
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  rawResponse: Note["rawResponse"];
  createdAt: string;
  updatedAt: string;
  trackLinks?: SerializedNoteTrackLink[];
};

function serializeTrackSummary(detail: TrackDetail): SerializedTrackSummary {
  return {
    id: detail.track.id,
    title: detail.track.title,
    artists: detail.artists,
    artworkUrl: detail.track.artworkUrl,
  };
}

export function serializeNote(note: Note, trackLinks?: SerializedNoteTrackLink[]): SerializedNote {
  return {
    id: note.id,
    rawText: note.rawText,
    extractionStatus: note.extractionStatus,
    extractionVersion: note.extractionVersion,
    extractionError: note.extractionError,
    extractionConfidence: note.extractionConfidence,
    extractionStartedAt: note.extractionStartedAt?.toISOString() ?? null,
    extractionFinishedAt: note.extractionFinishedAt?.toISOString() ?? null,
    extraction: note.extraction,
    provider: note.provider,
    model: note.model,
    promptVersion: note.promptVersion,
    rawResponse: note.rawResponse,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    ...(trackLinks !== undefined ? { trackLinks } : {}),
  };
}

export function serializeNoteTrackLink(
  link: NoteTrackLink,
  track: SerializedTrackSummary | null,
): SerializedNoteTrackLink {
  return {
    id: link.id,
    trackId: link.trackId,
    role: link.role,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    track,
  };
}

/** Resolve manual links and attach Neo4j track summaries when available. */
export async function loadSerializedTrackLinks(noteId: string): Promise<SerializedNoteTrackLink[]> {
  const links = await listNoteTrackLinks(noteId);
  return Promise.all(
    links.map(async (link) => {
      let track: SerializedTrackSummary | null = null;
      try {
        const detail = await getTrackById(link.trackId);
        track = detail ? serializeTrackSummary(detail) : null;
      } catch (error) {
        console.error(`failed to resolve track ${link.trackId} for note ${noteId}`, error);
        track = null;
      }
      return serializeNoteTrackLink(link, track);
    }),
  );
}
