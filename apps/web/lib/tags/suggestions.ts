export function canAddTag(values: Array<{ name: string }>, raw: string): string | null {
  const name = raw.trim();
  if (!name) return null;
  if (values.some((item) => item.name.toLowerCase() === name.toLowerCase())) return null;
  return name;
}

export function filterTagSuggestions<T extends { name: string }>(
  suggestions: T[],
  values: Array<{ name: string }>,
  draft: string,
  limit: number,
): T[] {
  const selected = new Set(values.map((item) => item.name.toLowerCase()));
  const draftTokens = draft.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return suggestions
    .filter((item) => !selected.has(item.name.toLowerCase()))
    .filter((item) => {
      if (draftTokens.length === 0) return true;
      const haystack = item.name.toLowerCase();
      return draftTokens.every((token) => haystack.includes(token));
    })
    .slice(0, limit);
}
