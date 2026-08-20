import { type Note, type NoteTrackLink } from "@selecta/db";
import { type TrackSummary } from "@selecta/library";
import {
  listNoteTrackLinksWithTracks,
  type NoteListItem,
  type NoteProposalLink,
} from "@selecta/submissions";

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

export type SerializedProposalLink = {
  id: string;
  proposalKey: string;
  status: NoteProposalLink["status"];
  sourceStart: number;
  sourceEnd: number;
  sourceText: string;
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
  proposalCounts?: {
    committed: number;
    needsReview: number;
    failed: number;
    total: number;
  };
  proposals?: SerializedProposalLink[];
};

function serializeTrackSummary(detail: TrackSummary): SerializedTrackSummary {
  return {
    id: detail.track.id,
    title: detail.track.title,
    artists: detail.artists,
    artworkUrl: detail.track.artworkUrl,
  };
}

export function serializeNote(
  note: Note,
  trackLinks?: SerializedNoteTrackLink[],
  listItem?: Pick<NoteListItem, "proposalCounts" | "proposals">,
): SerializedNote {
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
    ...(listItem
      ? {
          proposalCounts: listItem.proposalCounts,
          proposals: listItem.proposals,
        }
      : {}),
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

/** Resolve manual links with a tracks LEFT JOIN (+ batch summary hydrate). */
export async function loadSerializedTrackLinks(noteId: string): Promise<SerializedNoteTrackLink[]> {
  try {
    const rows = await listNoteTrackLinksWithTracks(noteId);
    return rows.map(({ link, track }) =>
      serializeNoteTrackLink(link, track ? serializeTrackSummary(track) : null),
    );
  } catch (error) {
    console.error(`failed to resolve tracks for note ${noteId}`, error);
    return [];
  }
}
