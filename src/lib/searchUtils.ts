/** Strip characters that would broaden SQL ILIKE patterns. */
export function sanitizeSearchToken(raw: string): string {
  return raw.replace(/[%_\\]/g, '').trim()
}

export function parseSearchQuery(q: string | null): string[] {
  if (!q) return []
  const parts = q
    .split(/\s+/)
    .map(sanitizeSearchToken)
    .filter((t) => t.length > 0)
    .slice(0, 8)
  return parts.map((t) => t.slice(0, 64))
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Short excerpt centered on first term match. */
export function excerptAroundMatch(text: string | null | undefined, terms: string[], before = 70, after = 130): string {
  const s = text?.trim() || ''
  if (!s) return ''
  if (terms.length === 0) return s.length > before + after ? `${s.slice(0, before + after)}…` : s
  const lower = s.toLowerCase()
  let idx = -1
  for (const t of terms) {
    const i = lower.indexOf(t.toLowerCase())
    if (i >= 0) {
      idx = i
      break
    }
  }
  if (idx < 0) return s.length > before + after ? `${s.slice(0, before + after)}…` : s
  const start = Math.max(0, idx - before)
  const end = Math.min(s.length, idx + after)
  return `${start > 0 ? '…' : ''}${s.slice(start, end)}${end < s.length ? '…' : ''}`
}
