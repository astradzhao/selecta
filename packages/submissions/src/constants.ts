/**
 * Intake constants shared by the API and the browser.
 *
 * This module is client-safe: no runtime imports from `client` / `pg` / drizzle
 * schema tables. Import from `@selecta/submissions/constants` in browser code.
 */
export const MAX_SUBMISSION_RAW_BYTES = 64 * 1024;

export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}
