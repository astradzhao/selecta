/** Shared submission-content / transition enums used by structured drafts. */

export const SUBMISSION_CONTENT_TYPES = ["transition", "song_note", "unknown", "mixed"] as const;
export type SubmissionContentType = (typeof SUBMISSION_CONTENT_TYPES)[number];

export const TRANSITION_QUALITIES = ["great", "ok", "risky"] as const;
export type TransitionQuality = (typeof TRANSITION_QUALITIES)[number];
