/** Normalize display names for unique vocab keys (Artist/Genre/Subgenre/Folder). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
