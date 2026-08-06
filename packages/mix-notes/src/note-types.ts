/** Shared note / transition enums used by structured drafts. */

export const NOTE_TYPES = ["transition", "song_note", "unknown", "mixed"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const TRANSITION_QUALITIES = ["great", "ok", "risky"] as const;
export type TransitionQuality = (typeof TRANSITION_QUALITIES)[number];
