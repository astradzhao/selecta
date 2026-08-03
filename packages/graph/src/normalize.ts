/** Normalize display names for MERGE uniqueness (Artist/Genre/Subgenre/Folder). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
