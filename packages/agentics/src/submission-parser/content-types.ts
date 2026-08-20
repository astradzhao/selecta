/** Shared submission-content enums used by structured drafts. */

export const SUBMISSION_CONTENT_TYPES = ["transition", "song_note", "unknown", "mixed"] as const;
export type SubmissionContentType = (typeof SUBMISSION_CONTENT_TYPES)[number];
