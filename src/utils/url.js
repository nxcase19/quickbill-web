/**
 * Resolve stored paths (e.g. /uploads/...) to absolute URLs for <img src> and assets.
 * Same API origin as axios (`VITE_API_URL`).
 */
export function toAbsoluteUrl(path) {
  if (!path) return ''

  const s = String(path).trim()
  if (s === '') return ''

  // already absolute
  if (s.startsWith('http')) return s

  const base = String(
    import.meta.env.VITE_API_URL || 'http://localhost:3001',
  ).replace(/\/$/, '')

  return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`
}
