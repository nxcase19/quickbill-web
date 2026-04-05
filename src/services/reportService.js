import api from './api.js'

/** TTL สำหรับ client-side report cache (ms) */
export const REPORT_CACHE_TTL_MS = 30_000

/**
 * Query key กลางสำหรับ dashboard reports — ใช้ซ้ำที่เดียว
 * @param {{ period: string, from?: string, to?: string }} filter
 * @returns {string} เช่น report:month:: | report:custom:2026-04-01:2026-04-05
 */
export function getReportFilterKey({ period, from, to }) {
  const p = String(period ?? '').trim()
  if (p === 'custom') {
    const f = String(from ?? '').slice(0, 10)
    const t = String(to ?? '').slice(0, 10)
    return `report:${p}:${f}:${t}`
  }
  return `report:${p}::`
}

/** Query params เดียวกับ backend: summary / vat-summary / export */
export function buildReportQueryParams(period, from, to) {
  const params = { period }
  if (period === 'custom') {
    if (from) params.from = from
    if (to) params.to = to
  }
  return params
}

/**
 * @param {{ period: string, from?: string, to?: string }} filter
 */
export async function getReportSummary(filter) {
  const { period, from, to } = filter
  const params = buildReportQueryParams(period, from, to)
  const res = await api.get('/api/reports/summary', { params })
  return res.data?.summary ?? res.data ?? null
}

/**
 * @param {{ period: string, from?: string, to?: string }} filter
 */
export async function getVatSummary(filter) {
  const { period, from, to } = filter
  const params = buildReportQueryParams(period, from, to)
  const res = await api.get('/api/reports/vat-summary', { params })
  return res.data?.summary ?? res.data ?? null
}
