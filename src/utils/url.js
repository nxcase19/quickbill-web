/**
 * Resolve stored paths (e.g. /uploads/...) to absolute URLs for <img src> and assets.
 * Frontend must point at the API origin in dev/prod (VITE_API_BASE_URL).
 */
export function toAbsoluteUrl(path) {
  if (!path) return ''

  const s = String(path).trim()
  if (s === '') return ''

  // already absolute
  if (s.startsWith('http')) return s

  const base = String(
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  ).replace(/\/$/, '')

  return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`
}
