/**
 * @deprecated Prefer `startSubmissionWorkflow` (DJ-66 durable path).
 * Kept as a thin alias so older call sites still enqueue extraction.
 */
export { startSubmissionWorkflow as runNoteExtraction } from "./start-submission-workflow";
