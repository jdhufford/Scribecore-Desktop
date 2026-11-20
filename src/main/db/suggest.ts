// Tag suggestions, ported from the web app's extract_keywords / suggest_tags
// (app.py 213-237 and 793-824). Runs locally; no AI involved.

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see',
  'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'with',
  'this', 'that', 'have', 'from', 'they', 'will', 'been', 'more', 'when', 'make', 'than',
  'into', 'time', 'very', 'what', 'about', 'which', 'were', 'also', 'some', 'them', 'then',
  'there', 'their', 'would', 'could', 'should', 'after', 'before', 'over', 'just', 'like',
])

export const MAX_SUGGESTIONS = 8

/** Up to 10 most frequent non-stop-words of 3+ letters; ties keep first-seen order. */
export function extractKeywords(text: string, minLength = 3): string[] {
  const words = text.toLowerCase().match(new RegExp(`\\b[a-z]{${minLength},}\\b`, 'g')) ?? []
  const counts = new Map<string, number>()
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  // Array.prototype.sort is stable, so equal counts stay in first-seen order (like Counter).
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w)
}

/**
 * Existing tags that overlap a keyword come first (in the order given, which is
 * most-used first), then new keywords. At most MAX_SUGGESTIONS.
 */
export function suggestTags(task: string, notes: string, existingTags: string[]): string[] {
  const keywords = extractKeywords(`${task} ${notes}`)
  const suggestions: string[] = []
  for (const tag of existingTags) {
    if (keywords.some((k) => k.includes(tag) || tag.includes(k))) suggestions.push(tag)
  }
  const existing = new Set(existingTags)
  for (const k of keywords) {
    if (!suggestions.includes(k) && !existing.has(k)) suggestions.push(k)
  }
  return suggestions.slice(0, MAX_SUGGESTIONS)
}
