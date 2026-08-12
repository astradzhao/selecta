export type SpanLocation = {
  start: number;
  end: number;
  mode: "exact" | "search" | "standalone";
};

function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Locate a proposal span inside immutable submission text. */
export function locateSpan(
  rawText: string,
  sourceStart: number,
  sourceEnd: number,
  sourceText: string,
): SpanLocation {
  const slice = rawText.slice(sourceStart, sourceEnd);
  if (normalizeForMatch(slice) === normalizeForMatch(sourceText)) {
    return { start: sourceStart, end: sourceEnd, mode: "exact" };
  }

  const index = rawText.indexOf(sourceText);
  if (index >= 0) {
    return { start: index, end: index + sourceText.length, mode: "search" };
  }

  return { start: 0, end: 0, mode: "standalone" };
}
