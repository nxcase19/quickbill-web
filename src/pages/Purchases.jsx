import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api.js'
import { useBilling } from '../context/BillingContext.jsx'

const API_BASE = '/api/purchases'
const API_PURCHASE_INVOICES = '/api/purchase-invoices'

export default function Purchases() {
  const { billingFeatureEnabled, openUpgrade } = useBilling()
  const canTax = billingFeatureEnabled('tax_purchase')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)

  const [editingId, setEditingId] = useState(null)

  const [supplierName, setSupplierName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [docNo, setDocNo] = useState('')
  const [docDate, setDocDate] = useState('')
  const [subtotal, setSubtotal] = useState('')
  const [vatAmount, setVatAmount] = useState('')
  const [total, setTotal] = useState('')
  const [note, setNote] = useState('')

  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3200)
    return () => clearTimeout(t)
  }, [toast])

  const clearForm = useCallback(() => {
    setEditingId(null)
    setSupplierName('')
    setTaxId('')
    setDocNo('')
    setDocDate('')
    setSubtotal('')
    setVatAmount('')
    setTotal('')
    setNote('')
  }, [])

  const fetchPurchases = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(API_BASE, {
        params: showCancelled ? { include_cancelled: true } : undefined,
      })
      const list = Array.isArray(data) ? data : data?.purchases || []
      setRows(list)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [showCancelled])

  useEffect(() => {
    if (!canTax) {
      setRows([])
      setLoading(false)
      return
    }
    fetchPurchases()
  }, [fetchPurchases, canTax])

  function fillFormFromRow(r) {
    setEditingId(r.id)
    setSupplierName(r.supplier_name != null ? String(r.supplier_name) : '')
    setTaxId(r.tax_id != null ? String(r.tax_id) : '')
    setDocNo(r.doc_no != null ? String(r.doc_no) : '')
    setDocDate(
      r.doc_date ? String(r.doc_date).slice(0, 10) : '',
    )
    setSubtotal(r.subtotal != null ? String(r.subtotal) : '')
    setVatAmount(r.vat_amount != null ? String(r.vat_amount) : '')
    setTotal(r.total != null ? String(r.total) : '')
    setNote(r.note != null ? String(r.note) : '')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const supplier = supplierName.trim()
    if (!supplier) return

    const payload = {
      supplier_name: supplier,
      tax_id: taxId.trim(),
      doc_no: docNo.trim(),
      doc_date: docDate || null,
      subtotal: subtotal === '' ? 0 : Number(subtotal) || 0,
      vat_amount: vatAmount === '' ? 0 : Number(vatAmount) || 0,
      total: total === '' ? 0 : Number(total) || 0,
      note: note.trim(),
    }

    setSubmitting(true)
    try {
      if (editingId != null) {
        await api.put(`${API_BASE}/${editingId}`, payload)
      } else {
        await api.post(API_BASE, payload)
      }

      clearForm()
      window.alert('บันทึกสำเร็จ')
      setToast('บันทึกสำเร็จ')
      await fetchPurchases()
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  function purchaseIsFromPo(r) {
    if (String(r?.source_type || '').toLowerCase() === 'po') return true
    return String(r?.source || '').toUpperCase() === 'PO'
  }

  function purchaseIsCancelled(r) {
    return String(r?.status || '').toLowerCase() === 'cancelled'
  }

  function statusBadge(r) {
    if (purchaseIsCancelled(r)) {
      return (
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          ยกเลิกแล้ว
        </span>
      )
    }
    return (
      <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        ใช้งาน
      </span>
    )
  }

  async function handleCancel(row) {
    if (purchaseIsFromPo(row) || purchaseIsCancelled(row)) return
    if (!window.confirm('ยืนยันการยกเลิกเอกสารนี้?')) return
    try {
      await api.put(`${API_PURCHASE_INVOICES}/${row.id}/cancel`)
      if (editingId === row.id) clearForm()
      setToast('ยกเลิกสำเร็จ')
      await fetchPurchases()
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'ยกเลิกไม่สำเร็จ')
    }
  }

  if (!canTax) {
    return (
      <div className="flex min-h-svh flex-col gap-6 py-8 md:py-10">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">ภาษีซื้อ</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-amber-950">
            ฟีเจอร์ภาษีซื้อใช้ได้ในแพ็กเกจ PRO
            <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-950">
              PRO
            </span>
          </p>
          <p className="mt-2 text-sm text-amber-900/90">
            อัปเกรดเพื่อบันทึกและจัดการใบกำกับภาษีซื้อ
          </p>
          <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="min-h-11 w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
              onClick={() => openUpgrade('อัปเกรดเพื่อใช้งานฟีเจอร์นี้')}
            >
              อัปเกรดแพ็กเกจ
            </button>
            <Link
              to="/pricing"
              className="flex min-h-11 w-full items-center justify-center rounded-lg border border-amber-300 bg-white px-5 py-2.5 text-center text-sm font-medium text-amber-950 hover:bg-amber-100 sm:w-auto"
            >
              ดูแพ็กเกจ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col gap-8 py-8 md:py-10">
      {toast ? (
        <div
          className="fixed right-4 top-20 z-50 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">ภาษีซื้อ</h1>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={showCancelled}
          onChange={(e) => setShowCancelled(e.target.checked)}
          className="rounded border-slate-300"
        />
        แสดงรายการที่ยกเลิกแล้ว
      </label>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
      >
        {editingId != null ? (
          <p className="md:col-span-2 text-sm text-amber-800">
            กำลังแก้ไขรายการ #{editingId}{' '}
            <button
              type="button"
              className="ml-2 text-slate-600 underline"
              onClick={clearForm}
            >
              ยกเลิก
            </button>
          </p>
        ) : null}
        <div>
          <label className="mb-1 block text-sm text-slate-600">ชื่อผู้ขาย</label>
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">เลขผู้เสียภาษี</label>
          <input
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">เลขเอกสาร</label>
          <input
            type="text"
            value={docNo}
            onChange={(e) => setDocNo(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">วันที่เอกสาร</label>
          <input
            type="date"
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">มูลค่าสินค้า</label>
          <input
            type="number"
            step="any"
            value={subtotal}
            onChange={(e) => setSubtotal(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">ภาษีมูลค่าเพิ่ม</label>
          <input
            type="number"
            step="any"
            value={vatAmount}
            onChange={(e) => setVatAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">ยอดรวม</label>
          <input
            type="number"
            step="any"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">หมายเหตุ</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {editingId != null ? 'อัปเดต' : 'บันทึก'}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-700">
            <tr>
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2">เอกสาร</th>
              <th className="px-3 py-2">ผู้ขาย</th>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2 text-right">subtotal</th>
              <th className="px-3 py-2 text-right">vat</th>
              <th className="px-3 py-2 text-right">total</th>
              <th className="px-3 py-2 w-[180px]"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={8}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={8}>
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">{r.doc_date ? String(r.doc_date).slice(0, 10) : '-'}</td>
                    <td className="px-3 py-2">{r.doc_no || '-'}</td>
                    <td className="px-3 py-2">{r.supplier_name}</td>
                    <td className="px-3 py-2">{statusBadge(r)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.subtotal || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.vat_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Number(r.total || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => fillFormFromRow(r)}
                        disabled={purchaseIsCancelled(r)}
                        className="mr-2 rounded bg-amber-100 px-2 py-1 text-amber-900 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        แก้ไข
                      </button>
                      {purchaseIsFromPo(r) ? (
                        <span
                          className="inline-block"
                          title="เอกสารจาก PO ไม่สามารถยกเลิกได้"
                        >
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded bg-slate-100 px-2 py-1 text-slate-400"
                          >
                            ยกเลิก
                          </button>
                        </span>
                      ) : purchaseIsCancelled(r) ? (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded bg-slate-100 px-2 py-1 text-slate-400"
                        >
                          ยกเลิก
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCancel(r)}
                          className="rounded bg-red-100 px-2 py-1 text-red-800 hover:bg-red-200"
                        >
                          ยกเลิก
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
