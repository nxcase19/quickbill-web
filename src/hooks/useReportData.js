import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getReportFilterKey,
  getReportSummary,
  getVatSummary,
  REPORT_CACHE_TTL_MS,
} from '../services/reportService.js'

const DEBOUNCE_MS = 300

/**
 * @typedef {{ summary: unknown, vatSummary: unknown }} ReportPair
 * @typedef {{ data: ReportPair, storedAt: number, lastUpdatedAt: number }} CacheEntry
 */

/** @type {Record<string, CacheEntry>} */
const reportDataCache = Object.create(null)

function isCacheFresh(entry) {
  return Date.now() - entry.storedAt < REPORT_CACHE_TTL_MS
}

/**
 * Dashboard report data: debounced fetch, TTL cache, stale-while-revalidate, refresh / invalidate
 */
export function useReportData({ period, from, to }) {
  const [summary, setSummary] = useState(null)
  const [vatSummary, setVatSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [cacheNonce, setCacheNonce] = useState(0)

  const debounceTimerRef = useRef(null)
  const requestIdRef = useRef(0)

  const hasReportData = summary != null || vatSummary != null
  const displayLoading = loading && !hasReportData
  const showErrorBlank = Boolean(error && !hasReportData)

  const invalidate = useCallback((all = false) => {
    if (all) {
      for (const k of Object.keys(reportDataCache)) {
        delete reportDataCache[k]
      }
    } else {
      if (period === 'custom' && (!from || !to)) return
      const key = getReportFilterKey({ period, from, to })
      delete reportDataCache[key]
    }
    setCacheNonce((n) => n + 1)
  }, [period, from, to])

  const refresh = useCallback(async () => {
    if (period === 'custom' && (!from || !to)) return

    const filter = { period, from, to }
    const key = getReportFilterKey(filter)

    requestIdRef.current += 1
    const rid = requestIdRef.current

    setIsRefreshing(true)
    setError(null)

    try {
      const [sum, vat] = await Promise.all([
        getReportSummary(filter),
        getVatSummary(filter),
      ])
      if (rid !== requestIdRef.current) return

      const now = Date.now()
      reportDataCache[key] = {
        data: { summary: sum, vatSummary: vat },
        storedAt: now,
        lastUpdatedAt: now,
      }
      setSummary(sum)
      setVatSummary(vat)
      setLastUpdatedAt(now)
      setLoading(false)
      setError(null)
    } catch (err) {
      console.error('[useReportData] refresh', err)
      if (rid !== requestIdRef.current) return
      setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ')
    } finally {
      if (rid === requestIdRef.current) setIsRefreshing(false)
    }
  }, [period, from, to])

  useEffect(() => {
    let cancelled = false

    if (debounceTimerRef.current != null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      if (cancelled) return

      if (period === 'custom' && (!from || !to)) {
        setSummary(null)
        setVatSummary(null)
        setLoading(false)
        setError(null)
        setLastUpdatedAt(null)
        return
      }

      const filter = { period, from, to }
      const key = getReportFilterKey(filter)
      const entry = reportDataCache[key]

      if (entry && isCacheFresh(entry)) {
        setSummary(entry.data.summary)
        setVatSummary(entry.data.vatSummary)
        setLastUpdatedAt(entry.lastUpdatedAt)
        setLoading(false)
        setError(null)
        return
      }

      if (entry && !isCacheFresh(entry)) {
        setSummary(entry.data.summary)
        setVatSummary(entry.data.vatSummary)
        setLastUpdatedAt(entry.lastUpdatedAt)
        setLoading(false)
        setError(null)

        requestIdRef.current += 1
        const rid = requestIdRef.current

        Promise.all([getReportSummary(filter), getVatSummary(filter)])
          .then(([sum, vat]) => {
            if (cancelled || rid !== requestIdRef.current) return
            const now = Date.now()
            reportDataCache[key] = {
              data: { summary: sum, vatSummary: vat },
              storedAt: now,
              lastUpdatedAt: now,
            }
            setSummary(sum)
            setVatSummary(vat)
            setLastUpdatedAt(now)
            setError(null)
          })
          .catch((err) => {
            console.error('[useReportData] revalidate', err)
            if (cancelled || rid !== requestIdRef.current) return
            setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ')
          })
        return
      }

      setSummary(null)
      setVatSummary(null)
      setLoading(true)
      setError(null)

      requestIdRef.current += 1
      const rid = requestIdRef.current

      Promise.all([getReportSummary(filter), getVatSummary(filter)])
        .then(([sum, vat]) => {
          if (cancelled || rid !== requestIdRef.current) return
          const now = Date.now()
          reportDataCache[key] = {
            data: { summary: sum, vatSummary: vat },
            storedAt: now,
            lastUpdatedAt: now,
          }
          setSummary(sum)
          setVatSummary(vat)
          setLastUpdatedAt(now)
          setLoading(false)
          setError(null)
        })
        .catch((err) => {
          console.error('[useReportData] initial fetch', err)
          if (cancelled || rid !== requestIdRef.current) return
          setSummary(null)
          setVatSummary(null)
          setLoading(false)
          setError(err?.message || 'โหลดข้อมูลไม่สำเร็จ')
          setLastUpdatedAt(null)
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      if (debounceTimerRef.current != null) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [period, from, to, cacheNonce])

  return {
    summary,
    vatSummary,
    loading,
    error,
    isRefreshing,
    lastUpdatedAt,
    refresh,
    invalidate,
    /** true เฉพาะตอนยังไม่มีข้อมูลแสดงและกำลังโหลดครั้งแรก */
    displayLoading,
    /** แสดง -- บนการ์ดเมื่อ error และยังไม่มีข้อมูล */
    showErrorBlank,
    /** มีข้อมูลอย่างน้อยหนึ่งชุด (สำหรับ error banner) */
    hasReportData,
  }
}
