import { useEffect, useMemo, useState } from 'react'
import api from '../services/api.js'
import { useBilling } from '../context/BillingContext.jsx'
import { downloadBlobFromApiResponse } from '../utils/exportDownload.js'

function formatMoney(v) {
  return Number(v || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function SummaryCard({ title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(value)}</p>
    </div>
  )
}

export default function PP30() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const { billingFeatureEnabled, openUpgrade } = useBilling()
  const canExport = billingFeatureEnabled('export')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await api.get('/api/reports/pp30', { params: { month } })
        const report = res.data?.report || res.data
        if (!cancelled) setData(report)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [month])

  const payableColor = useMemo(() => {
    const v = Number(data?.vat_payable || 0)
    if (v > 0) return 'text-red-700'
    if (v < 0) return 'text-green-700'
    return 'text-slate-900'
  }, [data?.vat_payable])

  async function handleExport() {
    if (!canExport) {
      openUpgrade('ฟีเจอร์นี้ใช้ได้เฉพาะแพ็กเกจ Pro')
      return
    }
    try {
      const res = await api.get('/api/reports/pp30/export', {
        params: { month },
        responseType: 'blob',
      })

      downloadBlobFromApiResponse(res)
    } catch (err) {
      alert(err?.response?.data?.error || 'Export PP30 failed')
    }
  }

  return (
    <div className="flex min-h-svh flex-col gap-6 py-8 md:py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">รายงาน ภ.พ.30</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border px-3 py-2 rounded"
        />
        <button
          type="button"
          onClick={handleExport}
          className={`rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 ${!canExport ? 'opacity-70' : ''}`}
          aria-disabled={!canExport}
        >
          <span className="inline-flex flex-wrap items-center gap-1">
            Export
            {!canExport ? (
              <>
                <span aria-hidden>🔒</span>
                <span className="rounded bg-white/20 px-1 text-xs font-bold">PRO</span>
              </>
            ) : null}
          </span>
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500">กำลังโหลด...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard title="ยอดขายก่อนภาษี" value={data?.total_sales} />
            <SummaryCard title="VAT ขาย" value={data?.vat_sales} />
            <SummaryCard title="VAT ซื้อ" value={data?.vat_purchase} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">ต้องจ่าย</p>
            <p className={`mt-2 text-3xl font-bold ${payableColor}`}>
              {formatMoney(data?.vat_payable)}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

