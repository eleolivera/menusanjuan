/**
 * Normalize text for flexible search:
 * - lowercase
 * - strip accents (á→a, ñ→n, ü→u)
 * - collapse whitespace
 */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/\s+/g, " ")
    .trim();
}

export function flexMatch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return normalizeSearch(haystack).includes(normalizeSearch(needle));
}
