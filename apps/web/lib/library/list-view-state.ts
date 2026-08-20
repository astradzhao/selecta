export const FILTERED_EMPTY_DESCRIPTION = "Try clearing a filter or searching for something else.";

export function listViewPhase(input: {
  hasFetched: boolean;
  error: string | null;
  hasContent: boolean;
}): "error" | "loading" | "ready" {
  if (input.error && !input.hasContent) return "error";
  if (!input.hasFetched && !input.error) return "loading";
  return "ready";
}

export function emptyStateCopy(
  hasFilters: boolean,
  copy: { noneTitle: string; noneDescription: string; filteredTitle: string },
): { title: string; description: string; showAction: boolean } {
  if (hasFilters) {
    return {
      title: copy.filteredTitle,
      description: FILTERED_EMPTY_DESCRIPTION,
      showAction: false,
    };
  }
  return {
    title: copy.noneTitle,
    description: copy.noneDescription,
    showAction: true,
  };
}

export function formatListCount(
  count: number,
  { singular, plural, hasMore = false }: { singular: string; plural: string; hasMore?: boolean },
): string {
  return `${count}${hasMore ? "+" : ""} ${count === 1 ? singular : plural}`;
}
