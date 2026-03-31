import { useState, useEffect, useMemo } from 'react'
import api from '../services/api.js'
import { dispatchUpgradeModal } from '../components/UpgradeModal.jsx'
import { useBilling } from '../context/BillingContext.jsx'
import { getCurrentPlan } from '../utils/planClient.js'

function todayDocDate() {
  return new Date().toISOString().slice(0, 10)
}

const DOC_TYPES = [
  { value: 'QT', label: 'ใบเสนอราคา' },
  { value: 'DN', label: 'ใบส่งสินค้า' },
  { value: 'INV', label: 'ใบแจ้งหนี้' },
  { value: 'RC', label: 'ใบเสร็จรับเงิน' },
]

function createEmptyItem() {
  return { description: '', qty: 1, price: '' }
}

export default function CreateDocument() {
  const [docTypes, setDocTypes] = useState(['INV'])
  const [vatEnabled, setVatEnabled] = useState(false)
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [manualCustomer, setManualCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    tax_id: '',
  })
  const [items, setItems] = useState(() => [createEmptyItem()])
  const [note, setNote] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { plan } = useBilling()
  const planSnap = plan ?? getCurrentPlan()
  const showFreeWatermarkNote =
    planSnap &&
    !planSnap.trialActive &&
    String(planSnap.effectivePlan || 'free').toLowerCase() === 'free'

  useEffect(() => {
    if (!items || items.length === 0) {
      setItems([createEmptyItem()])
    }
  }, [items])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingCustomers(true)
      try {
        const { data } = await api.get('/api/customers')
        const list = Array.isArray(data) ? data : data?.customers || []
        if (!cancelled) setCustomers(list)
      } catch {
        if (!cancelled) setCustomers([])
      } finally {
        if (!cancelled) setLoadingCustomers(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function addItem() {
    setItems((prev) => [...prev, createEmptyItem()])
  }

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  const { subtotal, vatRate, vatAmount, total } = useMemo(() => {
    let sum = 0
    for (const row of items) {
      const q = Number(row.qty)
      const p = row.price === '' ? 0 : Number(row.price)
      if (Number.isFinite(q) && Number.isFinite(p)) {
        sum += q * p
      }
    }
    const rate = vatEnabled ? 0.07 : 0
    const vat = sum * rate
    return {
      subtotal: sum,
      vatRate: rate,
      vatAmount: vat,
      total: sum + vat,
    }
  }, [items, vatEnabled])

  async function handleSubmit(e) {
    e.preventDefault()
    if (docTypes.length === 0) {
      alert('กรุณาเลือกประเภทเอกสารอย่างน้อย 1 รายการ')
      return
    }
    const payloadItems = items
      .filter((row) => row.description.trim())
      .map((row) => ({
        description: row.description.trim(),
        qty: Number(row.qty) || 0,
        unitPrice: row.price === '' ? 0 : Number(row.price) || 0,
      }))
    if (payloadItems.length === 0) return

    setSubmitting(true)
    try {
      let resolvedCustomerId = null
      if (customerId) {
        const selected = customers.find((c) => String(c.id) === customerId)
        if (!selected) {
          alert('ไม่พบลูกค้าที่เลือก กรุณาเลือกใหม่')
          return
        }
        resolvedCustomerId = selected.id
      } else if (!manualCustomer.name.trim()) {
        alert('กรุณาเลือกลูกค้าจากรายการ หรือกรอกชื่อลูกค้าในเอกสาร')
        return
      }

      await api.post('/api/documents', {
        doc_date: todayDocDate(),
        customerId: resolvedCustomerId,
        customer_name: manualCustomer.name.trim(),
        customer_address: manualCustomer.address.trim(),
        customer_phone: manualCustomer.phone.trim(),
        customer_tax_id: manualCustomer.tax_id.trim(),
        items: payloadItems,
        doc_types: docTypes,
        vat_enabled: vatEnabled,
        vat_rate: vatRate,
        note,
      })
      setItems([createEmptyItem()])
      setVatEnabled(false)
      setDocTypes(['INV'])
      setCustomerId('')
      setManualCustomer({ name: '', phone: '', address: '', tax_id: '' })
      setNote('')
      window.scrollTo(0, 0)
    } catch (err) {
      const data = err?.response?.data
      if (data?.code === 'LIMIT_REACHED' || data?.error === 'LIMIT_REACHED') {
        const msg =
          typeof data?.message === 'string' && data.message.trim() !== ''
            ? data.message
            : typeof data?.error === 'string' && data.error !== 'LIMIT_REACHED'
              ? data.error
              : 'คุณใช้ครบโควตาเอกสารวันนี้แล้ว — อัปเกรดเพื่อใช้งานต่อ'
        dispatchUpgradeModal({ reason: 'LIMIT_REACHED', message: msg })
        return
      }
      console.error(err)
      alert(
        (typeof data?.error === 'string' ? data.error : null) ||
          err?.message ||
          'สร้างเอกสารไม่สำเร็จ',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="flex min-h-svh flex-col gap-8 py-8 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">ออกเอกสาร</h1>
        {showFreeWatermarkNote ? (
          <p className="mt-1 text-xs text-slate-500">
            เอกสารของคุณมี watermark ในแพ็กเกจ Free
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="text-lg font-medium text-slate-800">ประเภทเอกสาร</label>
          <div className="flex flex-col gap-2">
            {DOC_TYPES.map((t) => (
              <label
                key={t.value}
                className="flex cursor-pointer items-center gap-3 text-lg text-slate-800"
              >
                <input
                  type="checkbox"
                  checked={docTypes.includes(t.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDocTypes((prev) => (prev.includes(t.value) ? prev : [...prev, t.value]))
                    } else {
                      setDocTypes((prev) => prev.filter((d) => d !== t.value))
                    }
                  }}
                  className="h-5 w-5 rounded border-slate-300"
                />
                <span>
                  {t.value} — {t.label}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-medium text-slate-800">ลูกค้า</h2>
            <p className="mt-1 text-xs text-slate-500">
              กรอกข้อมูลด้านล่างใช้เฉพาะบนเอกสารนี้เท่านั้น ระบบจะไม่บันทึกเป็นลูกค้าประจำ — หากต้องการเก็บรายชื่อถาวร
              ไปที่เมนู &quot;ลูกค้า&quot;
            </p>
          </div>
          {loadingCustomers ? (
            <p className="text-slate-500">กำลังโหลด…</p>
          ) : (
            <select
              value={customerId}
              onChange={(e) => {
                const v = e.target.value
                setCustomerId(v)
                if (v === '') return
                const customer = customers.find((c) => String(c.id) === String(v))
                if (!customer) return
                setManualCustomer({
                  name: customer.name ?? '',
                  phone: customer.phone ?? '',
                  address: customer.address ?? '',
                  tax_id: customer.tax_id ?? '',
                })
              }}
              className="w-full rounded-lg border border-slate-200 px-4 py-4 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
            >
              <option value="">เลือกลูกค้า</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="mt-4 flex flex-col gap-3">
            <input
              type="text"
              placeholder="ชื่อลูกค้า"
              value={manualCustomer.name}
              onChange={(e) =>
                setManualCustomer((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
            />
            <input
              type="text"
              placeholder="เบอร์โทร"
              value={manualCustomer.phone}
              onChange={(e) =>
                setManualCustomer((prev) => ({ ...prev, phone: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
            />
            <input
              type="text"
              placeholder="ที่อยู่"
              value={manualCustomer.address}
              onChange={(e) =>
                setManualCustomer((prev) => ({ ...prev, address: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
            />
            <input
              type="text"
              placeholder="เลขผู้เสียภาษี"
              value={manualCustomer.tax_id}
              onChange={(e) =>
                setManualCustomer((prev) => ({ ...prev, tax_id: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-medium text-slate-800">รายการ</h2>
          <button
            type="button"
            onClick={addItem}
            className="w-full rounded-xl bg-slate-900 px-6 py-4 text-lg font-medium text-white transition hover:bg-slate-800"
          >
            + เพิ่มรายการ
          </button>
          <div className="flex flex-col gap-6">
            {items.map((row, index) => (
              <div key={index} className="flex flex-col gap-3 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">รายการ</label>
                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="ชื่อสินค้า / รายการ"
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-800 focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">จำนวน</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.qty}
                      onChange={(e) => updateItem(index, 'qty', e.target.value)}
                      placeholder="จำนวน"
                      className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-800 focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">ราคาต่อหน่วย</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.price}
                      onChange={(e) => updateItem(index, 'price', e.target.value)}
                      placeholder="ราคาต่อหน่วย"
                      className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-800 focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="text-lg font-medium text-slate-800" htmlFor="doc-note">
            หมายเหตุ (ไม่บังคับ)
          </label>
          <textarea
            id="doc-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            placeholder="ระบุหมายเหตุเพิ่มเติมบนเอกสาร (ถ้ามี)"
          />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg text-slate-800">
            <input
              type="checkbox"
              checked={vatEnabled}
              onChange={(e) => setVatEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300"
            />
            VAT 7%
          </label>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex justify-between text-lg text-slate-700">
            <span>มูลค่าสินค้า</span>
            <span>{subtotal.toFixed(2)}</span>
          </div>
          {vatEnabled ? (
            <div className="flex justify-between text-lg text-slate-700">
              <span>ภาษีมูลค่าเพิ่ม</span>
              <span>{vatAmount.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-xl font-semibold text-slate-900">
            <span>ยอดรวม</span>
            <span>{total.toFixed(2)}</span>
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-slate-900 px-6 py-4 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? 'กำลังส่ง…' : 'ออกบิล'}
        </button>
      </form>
      </div>
    </>
  )
}
