/** Derive provider from an AI Gateway model id (`openai/gpt-4.1-mini` → `openai`). */
export function providerFromModel(model: string): string {
  const trimmed = model.trim();
  const slash = trimmed.indexOf("/");
  if (slash <= 0) {
    return "unknown";
  }
  return trimmed.slice(0, slash);
}
