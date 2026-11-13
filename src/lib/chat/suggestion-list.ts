/**
 * Client-safe guard for the follow-up suggestions a chat stream delivers
 * (`data: {"type":"suggestions","suggestions":[...]}`): keeps at most three
 * distinct non-empty strings of reasonable length. Used by the React chat pages;
 * public/widget.js has the same rule inline.
 */
export function cleanSuggestionList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const s = item.trim()
    if (s && s.length <= 120 && !out.includes(s)) out.push(s)
    if (out.length === 3) break
  }
  return out
}
