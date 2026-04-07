import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api.js'

function emptyItem() {
  return { description: '', quantity: 1, unit_price: '' }
}

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

export default function InvoiceCreate() {
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState('')
  const [docDate, setDocDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [note, setNote] = useState('')
  const [vatEnabled, setVatEnabled] = useState(false)
  const [items, setItems] = useState(() => [emptyItem()])
  const [whtEnabled, setWhtEnabled] = useState(false)
  const [whtType, setWhtType] = useState('SERVICE')
  const [whtRate, setWhtRate] = useState(3)
  const [submitting, setSubmitting] = useState(false)

  const { subtotal, vatAmount, total, whtAmount, netAmount } = useMemo(() => {
    let sum = 0
    for (const row of items) {
      const q = Number(row.quantity) || 0
      const p =
        row.unit_price === '' ? 0 : Number(row.unit_price)
      if (Number.isFinite(q) && Number.isFinite(p)) {
        sum += q * p
      }
    }
    const sub = round2(sum)
    const vat = vatEnabled ? round2(sub * 0.07) : 0
    const tot = round2(sub + vat)
    let wht = 0
    let net = tot
    if (whtEnabled && sub > 0) {
      wht = round2(sub * (Number(whtRate) / 100))
      net = round2(tot - wht)
    }
    return {
      subtotal: sub,
      vatAmount: vat,
      total: tot,
      whtAmount: wht,
      netAmount: net,
    }
  }, [items, vatEnabled, whtEnabled, whtRate])

  function updateItem(i, field, value) {
    setItems((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)),
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const name = customerName.trim()
    if (!name) {
      alert('กรุณากรอกชื่อลูกค้า')
      return
    }
    const payloadItems = items
      .filter((row) => String(row.description).trim())
      .map((row) => ({
        description: String(row.description).trim(),
        quantity: Number(row.quantity) || 0,
        unit_price:
          row.unit_price === '' ? 0 : Number(row.unit_price) || 0,
      }))
    if (payloadItems.length === 0) {
      alert('กรุณาเพิ่มรายการอย่างน้อย 1 แถว')
      return
    }
    if (total <= 0) {
      alert('ยอดรวมต้องมากกว่า 0')
      return
    }

    const body = {
      customer_name: name,
      doc_date: docDate || null,
      note: note.trim(),
      vat_type: vatEnabled ? 'vat7' : 'none',
      items: payloadItems,
      total,
      wht: {
        enabled: whtEnabled,
        type: whtType,
        rate: Number(whtRate) || 0,
      },
    }

    setSubmitting(true)
    try {
      await api.post('/api/invoices', body)
      alert('สร้างใบแจ้งหนี้แล้ว')
      navigate('/home')
    } catch (err) {
      console.error(err)
      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'สร้างไม่สำเร็จ',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 md:py-10">
      <h1 className="text-2xl font-semibold text-slate-800">
        สร้างใบแจ้งหนี้ (Sales invoice)
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        บันทึกลงตาราง invoices — รองรับภาษีหัก ณ ที่จ่าย
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            ชื่อลูกค้า *
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            วันที่เอกสาร
          </label>
          <input
            type="date"
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={vatEnabled}
              onChange={(e) => setVatEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            คิด VAT 7%
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-800">รายการ</p>
          <div className="mt-3 space-y-3">
            {items.map((row, i) => (
              <div
                key={i}
                className="grid gap-2 border-b border-slate-100 pb-3 sm:grid-cols-12"
              >
                <input
                  type="text"
                  placeholder="รายการ"
                  value={row.description}
                  onChange={(e) =>
                    updateItem(i, 'description', e.target.value)
                  }
                  className="sm:col-span-6 rounded border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="จำนวน"
                  value={row.quantity}
                  onChange={(e) =>
                    updateItem(i, 'quantity', e.target.value)
                  }
                  className="sm:col-span-2 rounded border border-slate-200 px-2 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="ราคา/หน่วย"
                  value={row.unit_price}
                  onChange={(e) =>
                    updateItem(i, 'unit_price', e.target.value)
                  }
                  className="sm:col-span-4 rounded border border-slate-200 px-2 py-1.5 text-sm"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setItems((p) => [...p, emptyItem()])}
            className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            + เพิ่มแถว
          </button>
        </div>

        <div className="wht-section rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={whtEnabled}
              onChange={(e) => setWhtEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            หัก ณ ที่จ่าย
          </label>

          {whtEnabled ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div>
                <label className="block text-xs text-slate-600">ประเภท</label>
                <select
                  value={whtType}
                  onChange={(e) => {
                    const type = e.target.value
                    setWhtType(type)
                    if (type === 'SERVICE') setWhtRate(3)
                    if (type === 'RENT') setWhtRate(5)
                  }}
                  className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="SERVICE">ค่าบริการ 3%</option>
                  <option value="RENT">ค่าเช่า 5%</option>
                  <option value="OTHER">อื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600">
                  อัตรา (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={whtRate}
                  onChange={(e) => setWhtRate(Number(e.target.value))}
                  className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            หมายเหตุ
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <div className="flex justify-between py-1">
            <span>ยอดก่อน VAT</span>
            <span className="font-medium">{subtotal.toFixed(2)}</span>
          </div>
          {vatEnabled ? (
            <div className="flex justify-between py-1">
              <span>VAT 7%</span>
              <span className="font-medium">{vatAmount.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-slate-100 py-2 font-semibold text-slate-900">
            <span>รวมทั้งสิ้น</span>
            <span>{total.toFixed(2)}</span>
          </div>
          {whtEnabled && subtotal > 0 ? (
            <>
              <div className="flex justify-between py-1 text-amber-900">
                <span>ภาษีหัก ณ ที่จ่าย</span>
                <span className="font-medium">− {whtAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 py-2 font-semibold text-emerald-800">
                <span>ยอดรับสุทธิ</span>
                <span>{netAmount.toFixed(2)}</span>
              </div>
            </>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? 'กำลังบันทึก…' : 'บันทึกใบแจ้งหนี้'}
        </button>
      </form>
    </div>
  )
}
