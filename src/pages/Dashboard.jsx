import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api.js'
import { useBilling } from '../context/BillingContext.jsx'
import { downloadBlobFromApiResponse } from '../utils/exportDownload.js'
import { FREE_DOCS_PER_DAY, FREE_DOCS_PER_MONTH } from '../utils/planClient.js'
import { getPlanAccess, hasFullProFeatureAccess } from '../utils/planAccess.js'

function dashboardPlanBadgeText(effective) {
  if (effective === 'business') return 'Business Plan'
  if (effective === 'pro') return 'Pro Plan'
  if (effective === 'basic') return 'Basic Plan'
  return 'Free Plan'
}

function formatAmount(v) {
  const n = Number(v || 0)
  return n.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const cardColors = {
  total: 'bg-white',
  paid: 'bg-blue-50 border-blue-200',
  unpaid: 'bg-orange-50 border-orange-200',
  taxSales: 'bg-red-50 border-red-200',
  taxPurchase: 'bg-green-50 border-green-200',
}

function Card({ title, value, tone = 'total' }) {
  const borderTone =
    tone === 'total' ? 'border-slate-200' : ''
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${borderTone} ${cardColors[tone] ?? cardColors.total}`}
    >
      <p className="text-sm text-slate-600">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {formatAmount(value)}
      </p>
    </div>
  )
}

/** ช่วงวันที่สำหรับ export ภาษี — อิง state ช่วงเวลาของ Dashboard (ไม่ hardcode วันคงที่) */
function getVatExportDateRange(period, from, to) {
  if (period === 'custom' && from && to) {
    return { from: String(from).slice(0, 10), to: String(to).slice(0, 10) }
  }

  const now = new Date()
  const y = now.getFullYear()
  const monthIndex = now.getMonth()

  if (period === 'day') {
    const mm = String(monthIndex + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const dayStr = `${y}-${mm}-${dd}`
    return { from: dayStr, to: dayStr }
  }

  if (period === 'year') {
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  }

  const mm = String(monthIndex + 1).padStart(2, '0')
  const first = `${y}-${mm}-01`
  const lastDay = new Date(y, monthIndex + 1, 0).getDate()
  const last = `${y}-${mm}-${String(lastDay).padStart(2, '0')}`
  return { from: first, to: last }
}

function getUsageStatus(used, limit) {
  if (!limit) return 'pro'

  const ratio = used / limit

  if (used >= limit) return 'full'
  if (ratio >= 0.8) return 'warning'
  return 'normal'
}

const BILLING_CELEBRATE_KEY = 'quickbill_billing_celebrate'

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    plan: billingPlanApi,
    openUpgrade,
    billingStatus,
    isFreeEffectivePlan,
  } = useBilling()
  const [celebrateProCheckout, setCelebrateProCheckout] = useState(false)
  const [trialInfo, setTrialInfo] = useState(null)
  const [usage, setUsage] = useState(null)
  const [summary, setSummary] = useState(null)
  const [vatSummary, setVatSummary] = useState(null)
  const [exportStatusFilter, setExportStatusFilter] = useState('all')
  const [docType, setDocType] = useState('')
  const [vatFilter, setVatFilter] = useState('all')
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const planReady = billingStatus === 'ready'
  const billingPlanLoading = billingStatus === 'loading' && billingPlanApi == null
  const billingPlanErrorNoData = billingStatus === 'error' && billingPlanApi == null

  const effectiveTier =
    billingPlanApi != null
      ? (() => {
        const v = billingPlanApi.effectivePlan ?? billingPlanApi.plan
        if (v == null || String(v).trim() === '') return null
        return String(v).toLowerCase()
      })()
      : null
  const accessPlan =
    billingPlanApi && hasFullProFeatureAccess(billingPlanApi)
      ? 'pro'
      : (effectiveTier ?? 'free')
  const access = getPlanAccess(accessPlan)
  const canExport = access.canExport
  const canTaxPurchaseExport = access.canExport && access.canUseAdvancedTax

  const planLabel = effectiveTier ?? ''
  const isFreePlan = planReady && isFreeEffectivePlan
  const planBadgeText =
    effectiveTier != null ? dashboardPlanBadgeText(effectiveTier) : 'แพ็กเกจ'
  const showFreePlanUi = isFreePlan

  const docsToday =
    usage?.today?.limit != null && Number.isFinite(Number(usage.today?.used))
      ? Number(usage.today.used)
      : billingPlanApi?.documentsCreatedToday != null &&
        Number.isFinite(Number(billingPlanApi.documentsCreatedToday))
        ? Number(billingPlanApi.documentsCreatedToday)
        : null

  useEffect(() => {
    try {
      if (sessionStorage.getItem(BILLING_CELEBRATE_KEY) === '1') {
        sessionStorage.removeItem(BILLING_CELEBRATE_KEY)
        setCelebrateProCheckout(true)
        const t = window.setTimeout(() => setCelebrateProCheckout(false), 12000)
        return () => clearTimeout(t)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    api
      .get('/api/billing/trial-status')
      .then((res) => setTrialInfo(res.data?.data ?? res.data))
      .catch(() => setTrialInfo(null))
  }, [])

  useEffect(() => {
    fetch('https://quickbill-server-production.up.railway.app/api/documents/usage', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsage(data)
        }
      })
  }, [])

  const handleExport = async () => {
    if (!canExport) {
      openUpgrade('อัปเกรดเพื่อใช้งานฟีเจอร์นี้')
      return
    }
    const params = {
      doc_type: docType,
      period,
      from,
      to,
    }
    if (exportStatusFilter !== 'all') {
      params.status = exportStatusFilter
    }
    if (!params.doc_type) delete params.doc_type
    if (vatFilter !== 'all') {
      params.vat = vatFilter
    }
    if (period !== 'custom') {
      delete params.from
      delete params.to
    }

    try {
      const res = await api.get('/api/reports/export', {
        params,
        responseType: 'blob',
      })
      downloadBlobFromApiResponse(res)
    } catch (err) {
      console.error(err)
      openUpgrade('อัปเกรดเพื่อใช้งานฟีเจอร์นี้')
    }
  }

  useEffect(() => {
    const params = { period }
    if (period === 'custom') {
      if (!from || !to) return
      params.from = from
      params.to = to
    }

    api
      .get('/api/reports/summary', { params })
      .then((res) => setSummary(res.data?.summary ?? res.data ?? null))
      .catch(() => setSummary(null))
  }, [period, from, to])

  useEffect(() => {
    api
      .get('/api/reports/vat-summary')
      .then((res) => setVatSummary(res.data?.summary ?? res.data ?? null))
      .catch(() => setVatSummary(null))
  }, [])

  const exportStatusBtn = (key) =>
    exportStatusFilter === key
      ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-2'
      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'

  const trialPlan = String(trialInfo?.plan ?? '').toLowerCase()
  const trialPaid =
    trialPlan === 'basic' || trialPlan === 'pro' || trialPlan === 'business'
  const trialDaysLeft = trialInfo?.daysLeft
  const trialExpired =
    Boolean(trialInfo?.trialEnds) &&
    trialDaysLeft != null &&
    trialDaysLeft <= 0
  const showTrialBanner =
    trialInfo &&
    !trialPaid &&
    (trialInfo.isTrialActive === true ||
      trialPlan === 'trial' ||
      trialExpired)
  const nearTrialEnd =
    !trialExpired &&
    trialDaysLeft != null &&
    trialDaysLeft > 0 &&
    trialDaysLeft <= 3

  return (
    <div className="flex min-h-svh flex-col gap-8 py-8 md:py-10">
      {billingPlanLoading ? (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
          role="status"
        >
          กำลังโหลดข้อมูลแพ็กเกจ…
        </div>
      ) : null}
      {billingPlanErrorNoData ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          โหลดข้อมูลแพ็กเกจไม่สำเร็จ กรุณารีเฟรช
        </div>
      ) : null}
      {showTrialBanner ? (
        trialExpired ? (
          <div
            role="alert"
            className="mb-1 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="text-2xl leading-none" aria-hidden>
                🚀
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-red-900 sm:text-lg">
                  ทดลองใช้งานหมดแล้ว กรุณาอัปเกรดเพื่อใช้งานต่อ
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-11 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                  onClick={() => navigate('/pricing?from=trial')}
                >
                  ดูแพ็คเกจ 🚀
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            role="status"
            className="mb-1 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 shadow-md"
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="text-2xl leading-none" aria-hidden>
                ⚡
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-amber-950 sm:text-lg">
                  ทดลองใช้งาน (Trial)
                </p>
                <p className="mt-1 text-sm text-amber-950/90 sm:text-base">
                  เหลือ {trialDaysLeft != null ? Math.max(0, trialDaysLeft) : '—'} วันก่อนหมดทดลอง
                </p>
                {nearTrialEnd ? (
                  <p className="mt-2 text-sm font-medium text-red-600 sm:text-base">
                    ⚠️ ใกล้หมดแล้ว อัปเกรดเพื่อใช้งานต่อ
                  </p>
                ) : null}
                <button
                  type="button"
                  className="mt-4 min-h-11 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
                  onClick={() => navigate('/pricing?from=trial')}
                >
                  ดูแพ็คเกจ 🚀
                </button>
              </div>
            </div>
          </div>
        )
      ) : null}
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-800">
          แพ็กเกจ: {String(planLabel || 'free').toUpperCase()}
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => navigate('/pricing')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
          >
            ดูแพ็คเกจ / อัพเกรด 🚀
          </button>
        </div>
        {isFreePlan && usage?.today?.limit != null ? (
          <div className="mt-2 text-xs text-orange-500">
            ใช้ไปแล้ว {usage.today.used} / {usage.today.limit}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">Dashboard</h1>
          {showFreePlanUi ? (
            <p className="text-xs text-slate-500">
              เอกสาร PDF ของคุณจะแสดง watermark ในแพ็กเกจ Free
            </p>
          ) : null}
        </div>
        {billingPlanLoading && effectiveTier == null ? (
          <span
            className="inline-flex h-8 w-28 shrink-0 animate-pulse rounded-full bg-slate-200"
            aria-hidden
          />
        ) : billingPlanErrorNoData ? null : effectiveTier != null && effectiveTier !== 'trial' ? (
          <span
            className="inline-flex w-fit shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-800"
            aria-label="แพ็กเกจปัจจุบัน"
          >
            {planBadgeText}
            {celebrateProCheckout && effectiveTier === 'pro' ? ' 🎉' : ''}
          </span>
        ) : null}
      </div>

      {usage && isFreePlan && (
        <div
          style={{
            padding: '14px',
            borderRadius: '12px',
            marginBottom: '16px',
            background:
              getUsageStatus(usage.today.used, usage.today.limit) === 'full'
                ? '#fee2e2'
                : getUsageStatus(usage.today.used, usage.today.limit) === 'warning'
                  ? '#fef3c7'
                  : '#f1f5f9',
            border:
              getUsageStatus(usage.today.used, usage.today.limit) === 'full'
                ? '1px solid #ef4444'
                : getUsageStatus(usage.today.used, usage.today.limit) === 'warning'
                  ? '1px solid #f59e0b'
                  : '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            วันนี้: {usage.today.used} / {usage.today.limit ?? '∞'} บิล
          </div>

          <div style={{ marginBottom: '8px' }}>
            เดือนนี้: {usage.month.used} / {usage.month.limit ?? '∞'} บิล
          </div>

          {getUsageStatus(usage.today.used, usage.today.limit) === 'warning' && (
            <div style={{ color: '#b45309', fontSize: '13px' }}>
              ⚠️ คุณกำลังใกล้ถึงขีดจำกัดแล้ว
            </div>
          )}

          {getUsageStatus(usage.today.used, usage.today.limit) === 'full' && (
            <div style={{ marginTop: '10px' }}>
              <div
                style={{
                  color: '#b91c1c',
                  fontSize: '13px',
                  marginBottom: '8px',
                }}
              >
                ❌ คุณใช้ครบแล้ว อัปเกรดเพื่อใช้งานต่อ
              </div>

              <button
                type="button"
                onClick={() => navigate('/pricing?from=trial')}
                style={{
                  background: '#2563eb',
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                อัปเกรด PRO 🚀
              </button>
            </div>
          )}
        </div>
      )}

      {showFreePlanUi ? (
        <section
          className="rounded-xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm"
          aria-label="สถานะแพ็กเกจ"
        >
          <p className="text-sm font-semibold text-amber-950">คุณกำลังใช้แพ็กเกจ Free</p>
          {docsToday != null ? (
            <p className="mt-2 text-sm font-semibold text-amber-950">
              ใช้ไปแล้ว {docsToday} / {FREE_DOCS_PER_DAY} เอกสารวันนี้
            </p>
          ) : null}
          <p className="mt-2 text-sm text-amber-900/90">
            โควตา: สูงสุด {FREE_DOCS_PER_DAY} ฉบับต่อวัน และ {FREE_DOCS_PER_MONTH} ฉบับต่อเดือน
            (นับเมื่อสร้างเอกสาร — อัปเกรดเพื่อเอกสารไม่จำกัดและปิด watermark)
          </p>
          <Link
            to="/pricing?from=trial"
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
          >
            ดูแพ็กเกจและอัปเกรด
          </Link>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-800">สรุปยอดตามช่วงเวลา</h2>
        <p className="text-sm text-slate-500">
          ตัวเลขด้านล่างเป็นยอดรวมทั้งหมดในช่วงที่เลือก ไม่เกี่ยวกับตัวกรอง Export
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">ช่วงเวลา</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="month">เดือนนี้</option>
            <option value="day">วันนี้</option>
            <option value="year">ปีนี้</option>
            <option value="custom">กำหนดเอง</option>
          </select>
        </div>
        {period === 'custom' ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-800">ยอดเงิน (ภาพรวม)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="ยอดทั้งหมด" value={summary?.total_amount} tone="total" />
          <Card title="จ่ายแล้ว" value={summary?.paid_amount} tone="paid" />
          <Card title="ค้างจ่าย" value={summary?.unpaid_amount} tone="unpaid" />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-800">ภาษี (ภาพรวม)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="ภาษีขาย" value={vatSummary?.vat_sales} tone="taxSales" />
          <Card title="ภาษีซื้อ" value={vatSummary?.vat_purchase} tone="taxPurchase" />
          <div
            className={`rounded-xl border p-5 shadow-sm ${
              Number(vatSummary?.vat_payable ?? 0) > 0
                ? 'border-red-200 bg-red-50 text-red-700'
                : Number(vatSummary?.vat_payable ?? 0) < 0
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <p className="text-sm">ภาษีที่ต้องจ่าย</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatAmount(vatSummary?.vat_payable)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-4 border-t border-slate-200 pt-8">
        <div className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-slate-50/80 p-5 md:p-6">
          <div>
            <h2 className="text-base font-semibold text-slate-800">เลือกข้อมูลสำหรับ Export</h2>
            <p className="mt-1 text-sm text-slate-600">
              ตัวเลือกในส่วนนี้มีผลเฉพาะไฟล์ Export (Excel / ภาษี) — ไม่เปลี่ยนตัวเลขสรุปด้านบน
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!canExport) {
                  openUpgrade('อัปเกรดเพื่อใช้งานฟีเจอร์นี้')
                  return
                }
                try {
                  const { from: vf, to: vt } = getVatExportDateRange(period, from, to)
                  const res = await api.get('/api/reports/vat-sales/export', {
                    params: { from: vf, to: vt },
                    responseType: 'blob',
                  })
                  downloadBlobFromApiResponse(res)
                } catch (err) {
                  console.error(err)
                  openUpgrade('อัปเกรดเพื่อใช้งานฟีเจอร์นี้')
                }
              }}
              disabled={!canExport}
              className={`min-h-11 w-full rounded-lg bg-purple-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-purple-700 sm:flex-1 ${!canExport ? 'cursor-not-allowed opacity-70' : ''}`}
              aria-disabled={!canExport}
            >
              <span className="inline-flex flex-wrap items-center justify-center gap-1">
                Export ภาษีขาย
                {!canExport ? (
                  <>
                    <span aria-hidden>🔒</span>
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-bold">PRO</span>
                  </>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!canTaxPurchaseExport) {
                  openUpgrade('อัปเกรดเพื่อใช้งานฟีเจอร์นี้')
                  return
                }
                try {
                  const { from: vf, to: vt } = getVatExportDateRange(period, from, to)
                  const res = await api.get('/api/reports/vat-purchase/export', {
                    params: { from: vf, to: vt },
                    responseType: 'blob',
                  })
                  downloadBlobFromApiResponse(res)
                } catch (err) {
                  console.error(err)
                  openUpgrade('อัปเกรดเพื่อใช้งานฟีเจอร์นี้')
                }
              }}
              disabled={!canTaxPurchaseExport}
              className={`min-h-11 w-full rounded-lg bg-purple-600 px-4 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-purple-700 sm:flex-1 ${!canTaxPurchaseExport ? 'cursor-not-allowed opacity-70' : ''}`}
              aria-disabled={!canTaxPurchaseExport}
            >
              <span className="inline-flex flex-wrap items-center justify-center gap-1">
                Export ภาษีซื้อ
                {!canTaxPurchaseExport ? (
                  <>
                    <span aria-hidden>🔒</span>
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-bold">PRO</span>
                  </>
                ) : null}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600">ประเภทเอกสาร</span>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-auto"
              >
                <option value="">ทั้งหมด</option>
                <option value="INV">Invoice</option>
                <option value="RC">Receipt</option>
                <option value="QT">Quotation</option>
                <option value="DN">Delivery Note</option>
              </select>

              <span className="text-sm text-slate-600 sm:ml-2">VAT</span>
              <select
                value={vatFilter}
                onChange={(e) => setVatFilter(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-auto"
              >
                <option value="all">ทั้งหมด</option>
                <option value="vat_only">มี VAT</option>
                <option value="no_vat">ไม่มี VAT</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                สถานะการชำระ (สำหรับ Export Excel)
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setExportStatusFilter('all')}
                  className={`min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium transition sm:w-auto ${exportStatusBtn('all')}`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setExportStatusFilter('paid')}
                  className={`min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium transition sm:w-auto ${exportStatusBtn('paid')}`}
                >
                  จ่ายแล้ว
                </button>
                <button
                  type="button"
                  onClick={() => setExportStatusFilter('unpaid')}
                  className={`min-h-11 w-full rounded-lg px-4 py-2 text-sm font-medium transition sm:w-auto ${exportStatusBtn('unpaid')}`}
                >
                  ค้างจ่าย
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={handleExport}
                disabled={!canExport}
                className={`min-h-11 w-full rounded-lg border-2 border-emerald-600 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 sm:max-w-xs sm:px-6 ${!canExport ? 'cursor-not-allowed opacity-70' : ''}`}
                aria-disabled={!canExport}
              >
                <span className="inline-flex flex-wrap items-center justify-center gap-1">
                  Export Excel
                  {!canExport ? (
                    <>
                      <span aria-hidden>🔒</span>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-900">
                        PRO
                      </span>
                    </>
                  ) : null}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

