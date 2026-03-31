import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api.js'
import { useBilling } from '../context/BillingContext.jsx'
import { buildAuthHeaders } from '../utils/authClient.js'
import { openPdfInNewTab } from '../utils/openPdfWithAuth.js'
import { toAbsoluteUrl } from '../utils/url.js'

const API_PO = '/api/purchase-orders'

const emptyItem = () => ({
  description: '',
  quantity: '1',
  unit_price: '0',
})

function statusBadgeClass(status) {
  switch (status) {
    case 'draft':
      return 'bg-slate-100 text-slate-800 border-slate-200'
    case 'approved':
      return 'bg-blue-50 text-blue-800 border-blue-200'
    case 'received':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'paid':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200'
  }
}

function poStatusLabel(st) {
  switch (st) {
    case 'draft':
      return 'ร่าง'
    case 'approved':
      return 'อนุมัติแล้ว'
    case 'received':
      return 'รับสินค้าแล้ว'
    case 'cancelled':
      return 'ยกเลิก'
    case 'paid':
      return 'ชำระแล้ว'
    default:
      return String(st || '')
  }
}

function getPORowState(r, actionId) {
  const st = r.status || 'draft'
  const busy = actionId === r.id
  const normalizedStatus = String(st).toLowerCase()
  const isCancelled = normalizedStatus === 'cancelled'
  const isPaid = normalizedStatus === 'paid'
  const isTerminal = isPaid || isCancelled
  const canApprove = normalizedStatus === 'draft'
  const canReceive = normalizedStatus === 'approved'
  const canPay = normalizedStatus === 'received'
  const canCancel = !isTerminal
  return { st, busy, normalizedStatus, isCancelled, isPaid, isTerminal, canApprove, canReceive, canPay, canCancel }
}

export default function PurchaseOrders() {
  const { billingFeatureEnabled, openUpgrade } = useBilling()
  const canPO = billingFeatureEnabled('purchase_orders')

  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [companyLogoUrl, setCompanyLogoUrl] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState(null)

  const [editingId, setEditingId] = useState(null)

  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierAddress, setSupplierAddress] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [taxId, setTaxId] = useState('')
  const [docDate, setDocDate] = useState('')
  const [vatType, setVatType] = useState('none')
  const [note, setNote] = useState('')
  const [items, setItems] = useState([emptyItem()])

  const subtotal = items.reduce((sum, it) => {
    return sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0)
  }, 0)
  const vat = vatType === 'vat7' ? subtotal * 0.07 : 0
  const total = subtotal + vat

  const [toast, setToast] = useState(null)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierAddress, setNewSupplierAddress] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')
  const [newSupplierTaxId, setNewSupplierTaxId] = useState('')
  const [supplierSubmitting, setSupplierSubmitting] = useState(false)
  const API_BASE_URL = import.meta.env.VITE_API_URL

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(t)
  }, [toast])

  const clearForm = useCallback(() => {
    setEditingId(null)
    setSupplierId('')
    setSupplierName('')
    setSupplierAddress('')
    setSupplierPhone('')
    setTaxId('')
    setDocDate('')
    setVatType('none')
    setNote('')
    setItems([emptyItem()])
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(API_PO)
      const list = Array.isArray(data) ? data : data?.purchase_orders || data?.rows || []
      setRows(list)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!canPO) {
      setRows([])
      setLoading(false)
      return
    }
    fetchList()
  }, [fetchList, canPO])

  const fetchSuppliers = useCallback(async () => {
    try {
      const { data } = await api.get(`${API_PO}/suppliers/list`)
      const list = Array.isArray(data) ? data : data?.suppliers || []
      setSuppliers(list)
    } catch {
      setSuppliers([])
    }
  }, [])

  useEffect(() => {
    if (!canPO) {
      setSuppliers([])
      return
    }
    fetchSuppliers()
  }, [fetchSuppliers, canPO])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/api/company')
        const company = data?.company || data
        if (cancelled || !company) return
        setCompanyLogoUrl(company.logo_url ?? null)
      } catch {
        if (!cancelled) setCompanyLogoUrl(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const logoDisplaySrc = companyLogoUrl ? toAbsoluteUrl(companyLogoUrl) : null

  async function loadDetailForEdit(id) {
    try {
      const { data } = await api.get(`${API_PO}/${id}`)
      const po = data?.po || data
      setEditingId(id)
      setSupplierId(po.supplier_id != null ? String(po.supplier_id) : '')
      setSupplierName(po.supplier_name != null ? String(po.supplier_name) : '')
      setSupplierAddress(po.supplier_address != null ? String(po.supplier_address) : '')
      setSupplierPhone(po.supplier_phone != null ? String(po.supplier_phone) : '')
      setTaxId(
        po.supplier_tax_id != null ? String(po.supplier_tax_id) : po.tax_id != null ? String(po.tax_id) : '',
      )
      setDocDate(po.issue_date ? String(po.issue_date).slice(0, 10) : po.doc_date ? String(po.doc_date).slice(0, 10) : '')
      setVatType(po.vat_type === 'vat7' ? 'vat7' : 'none')
      setNote(po.note != null ? String(po.note) : '')
      const list = Array.isArray(po.items) ? po.items : []
      if (list.length === 0) {
        setItems([emptyItem()])
      } else {
        setItems(
          list.map((it) => ({
            description: it.description != null ? String(it.description) : '',
            quantity: String(it.quantity ?? '1'),
            unit_price: String(it.unit_price ?? '0'),
          })),
        )
      }
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'โหลดรายการไม่สำเร็จ')
    }
  }

  async function createFromExisting(id) {
    await loadDetailForEdit(id)
    setEditingId(null)
    setToast('คัดลอกข้อมูลแล้ว กรุณาบันทึกเพื่อสร้างเอกสารใหม่')
  }

  function buildPayload() {
    const body = {
      supplier_name: supplierName.trim(),
      supplier_address: supplierAddress.trim(),
      supplier_phone: supplierPhone.trim(),
      supplier_tax_id: taxId.trim(),
      tax_id: taxId.trim(),
      issue_date: docDate || null,
      doc_date: docDate || null,
      vat_type: vatType,
      note: note.trim(),
      items: items.map((it) => ({
        description: it.description.trim(),
        qty: it.quantity === '' ? 0 : Number(it.quantity) || 0,
        unit_price: it.unit_price === '' ? 0 : Number(it.unit_price) || 0,
      })),
    }
    return body
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!supplierName.trim()) {
      alert('กรุณากรอกชื่อผู้ขาย')
      return
    }

    setSubmitting(true)
    try {
      const payload = buildPayload()
      if (editingId) {
        await api.put(`${API_PO}/${editingId}`, payload)
        setToast('อัปเดตใบสั่งซื้อแล้ว')
      } else {
        await api.post(API_PO, payload)
        setToast('สร้างใบสั่งซื้อแล้ว')
      }
      clearForm()
      await fetchList()
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  async function approvePO(id) {
    console.log('Approving PO:', id)
    console.log('Sending request:', id)
    setActionId(id)
    try {
      const base = String(api.defaults.baseURL ?? '').replace(/\/$/, '')
      const headers = buildAuthHeaders({ 'Content-Type': 'application/json' })
      if (!headers) {
        alert('กรุณาเข้าสู่ระบบใหม่')
        return
      }
      const response = await fetch(`${base}${API_PO}/${id}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: 'approved' }),
      })
      console.log('Response:', response)
      let json
      try {
        json = await response.json()
      } catch (e) {
        console.error('Invalid JSON response')
        alert('Server error')
        return
      }
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'Request failed')
      }
      await fetchList()
      setToast('อนุมัติสำเร็จ')
    } catch (err) {
      console.error(err)
      alert(err?.message || 'ดำเนินการไม่สำเร็จ')
    } finally {
      setActionId(null)
    }
  }

  const receivePO = async (id) => {
    console.log('RECEIVE CLICK:', id)
    setActionId(id)
    try {
      const headers = buildAuthHeaders({ 'Content-Type': 'application/json' })
      if (!headers) {
        alert('กรุณาเข้าสู่ระบบใหม่')
        return
      }
      if (!API_BASE_URL) {
        throw new Error('Missing API base URL')
      }
      const res = await fetch(`${API_BASE_URL}/api/po/${id}/receive`, {
        method: 'PUT',
        headers,
      })
      let json
      try {
        json = await res.json()
      } catch (e) {
        console.error('Invalid JSON response')
        alert('Server error')
        return
      }
      console.log('RECEIVE RESPONSE:', json)
      if (!res.ok || !json?.success) {
        alert(json?.error || 'Request failed')
        return
      }

      alert('รับของเรียบร้อยแล้ว')
      await fetchList()
    } catch (err) {
      console.error(err)
      alert('ERROR receive PO')
    } finally {
      setActionId(null)
    }
  }

  const cancelPO = async (id) => {
    if (!window.confirm('คุณต้องการยกเลิกใบสั่งซื้อนี้หรือไม่?')) return
    setActionId(id)
    try {
      await api.post(`${API_PO}/${id}/cancel`, { cancel_reason: '' })
      setToast('ยกเลิกใบสั่งซื้อแล้ว')
      await fetchList()
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'ยกเลิกไม่สำเร็จ')
    } finally {
      setActionId(null)
    }
  }

  const payPO = async (id) => {
    console.log('PAY CLICK:', id)
    setActionId(id)
    try {
      const headers = buildAuthHeaders({ 'Content-Type': 'application/json' })
      if (!headers) {
        alert('กรุณาเข้าสู่ระบบใหม่')
        return
      }
      if (!API_BASE_URL) {
        throw new Error('Missing API base URL')
      }
      const res = await fetch(`${API_BASE_URL}/api/po/${id}/pay`, {
        method: 'PUT',
        headers,
      })
      let json
      try {
        json = await res.json()
      } catch (e) {
        console.error('Invalid JSON response')
        alert('Server error')
        return
      }
      console.log('PAY RESPONSE:', json)
      if (!res.ok || !json?.success) {
        alert(json?.error || 'Request failed')
        return
      }

      alert('ชำระเงินเรียบร้อยแล้ว')
      await fetchList()
    } catch (err) {
      console.error(err)
      alert('ERROR pay PO')
    } finally {
      setActionId(null)
    }
  }

  const openPoPdf = (id) => {
    openPdfInNewTab(`/api/po/${encodeURIComponent(id)}/pdf`)
  }

  function addItemRow() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItemRow(index) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  function handleSelectSupplier(id) {
    const selectedId = String(id || '')
    setSupplierId(selectedId)
    const s = suppliers.find((x) => String(x.id) === selectedId)
    if (!s) return
    setSupplierName(s.name != null ? String(s.name) : '')
    setSupplierAddress(s.address != null ? String(s.address) : '')
    setSupplierPhone(s.phone != null ? String(s.phone) : '')
    setTaxId(s.tax_id != null ? String(s.tax_id) : '')
  }

  async function createSupplierFromModal() {
    if (!newSupplierName.trim()) {
      alert('กรุณากรอกชื่อผู้ขาย')
      return
    }
    setSupplierSubmitting(true)
    try {
      const { data } = await api.post('/api/suppliers', {
        name: newSupplierName.trim(),
        address: newSupplierAddress.trim(),
        phone: newSupplierPhone.trim(),
        tax_id: newSupplierTaxId.trim(),
      })
      await fetchSuppliers()
      const createdId = data?.id != null ? String(data.id) : data?.supplier?.id != null ? String(data.supplier.id) : ''
      if (createdId) {
        handleSelectSupplier(createdId)
      }
      setShowSupplierModal(false)
      setNewSupplierName('')
      setNewSupplierAddress('')
      setNewSupplierPhone('')
      setNewSupplierTaxId('')
      setToast('เพิ่มผู้ขายแล้ว')
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'เพิ่มผู้ขายไม่สำเร็จ')
    } finally {
      setSupplierSubmitting(false)
    }
  }

  if (!canPO) {
    return (
      <div className="flex min-h-svh flex-col gap-6 py-8 md:py-10">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">ใบสั่งซื้อ (PO)</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-amber-950">
            ฟีเจอร์ใบสั่งซื้อใช้ได้ในแพ็กเกจ PRO
            <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-950">
              PRO
            </span>
          </p>
          <p className="mt-2 text-sm text-amber-900/90">
            แพ็กเกจ Basic ยังไม่รองรับใบสั่งซื้อ — อัปเกรดเป็น PRO เพื่อใช้งาน
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
        {logoDisplaySrc ? (
          <img
            src={logoDisplaySrc}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1 sm:h-20 sm:w-20"
          />
        ) : (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] font-semibold tracking-wide text-slate-400 sm:h-20 sm:w-20"
            aria-hidden
          >
            LOGO
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">ใบสั่งซื้อ (PO)</h1>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
      >
        {editingId != null ? (
          <p className="md:col-span-2 text-sm text-amber-800">
            แก้ไขรายการ (ฉบับร่าง) —{' '}
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
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm text-slate-600">เลือกผู้ขาย</label>
            <button
              type="button"
              onClick={() => setShowSupplierModal(true)}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              + เพิ่มผู้ขาย
            </button>
          </div>
          <select
            value={supplierId}
            onChange={(e) => handleSelectSupplier(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">-- เลือกผู้ขาย --</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
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
          <label className="mb-1 block text-sm text-slate-600">ที่อยู่ผู้ขาย</label>
          <input
            type="text"
            value={supplierAddress}
            onChange={(e) => setSupplierAddress(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">เบอร์โทรผู้ขาย</label>
          <input
            type="text"
            value={supplierPhone}
            onChange={(e) => setSupplierPhone(e.target.value)}
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
          <label className="mb-1 block text-sm text-slate-600">วันที่เอกสาร</label>
          <input
            type="date"
            value={docDate}
            onChange={(e) => setDocDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">VAT</label>
          <select
            value={vatType}
            onChange={(e) => setVatType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="none">ไม่มี VAT</option>
            <option value="vat7">VAT 7%</option>
          </select>
        </div>
        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-800">
            <div>
              <span className="text-slate-600">มูลค่าสินค้า:</span>{' '}
              <span className="font-medium">{subtotal.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-600">VAT:</span>{' '}
              <span className="font-medium">{vat.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-600">ยอดรวม:</span>{' '}
              <span className="font-semibold">{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">หมายเหตุ</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>

        <div className="md:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">รายการสินค้า</span>
            <button
              type="button"
              onClick={addItemRow}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100"
            >
              + แถว
            </button>
          </div>
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="grid gap-2 rounded border border-slate-100 bg-slate-50/50 p-2 sm:grid-cols-12"
              >
                <div className="sm:col-span-5">
                  <label className="mb-0.5 block text-xs text-slate-500">รายละเอียด</label>
                  <input
                    type="text"
                    value={it.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-0.5 block text-xs text-slate-500">จำนวน</label>
                  <input
                    type="number"
                    step="any"
                    value={it.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-0.5 block text-xs text-slate-500">ราคาต่อหน่วย</label>
                  <input
                    type="number"
                    step="any"
                    value={it.unit_price}
                    onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="flex items-end justify-end sm:col-span-3">
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    disabled={items.length <= 1}
                    className="rounded px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40"
                  >
                    ลบแถว
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 w-full rounded-lg bg-slate-900 px-4 py-3 text-base font-medium text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
          >
            {editingId != null ? 'บันทึกการแก้ไข (ฉบับร่าง)' : 'สร้างใบสั่งซื้อ (ฉบับร่าง)'}
          </button>
          {!editingId ? (
            <span className="text-sm text-slate-500 sm:ml-3">
              แก้ไขได้เฉพาะสถานะ &quot;ร่าง&quot; — ใช้ปุ่ม แก้ไข ในรายการ
            </span>
          ) : null}
        </div>
      </form>

      <div className="space-y-4 md:hidden">
        {loading ? (
          <p className="py-8 text-center text-slate-500">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-slate-500">ไม่มีข้อมูล</p>
        ) : (
          rows.map((r) => {
            const { st, busy, isCancelled, isTerminal, canApprove, canReceive, canPay, canCancel } =
              getPORowState(r, actionId)
            const dateStr = r.issue_date
              ? String(r.issue_date).slice(0, 10)
              : r.doc_date
                ? String(r.doc_date).slice(0, 10)
                : r.created_at
                  ? String(r.created_at).slice(0, 10)
                  : '-'
            const btnBase = 'min-h-11 w-full rounded-lg px-3 text-sm font-medium disabled:opacity-40'
            return (
              <div
                key={r.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        เลขที่เอกสาร
                      </p>
                      <p className="font-mono text-lg font-semibold text-slate-900">{r.doc_no || '-'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(st)}`}
                      >
                        {poStatusLabel(st)}
                      </span>
                      {isCancelled ? (
                        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          ยกเลิกแล้ว
                        </span>
                      ) : isTerminal ? (
                        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          ล็อกแล้ว
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{r.supplier_name}</p>
                  <p className="text-xs text-slate-500">วันที่ {dateStr}</p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-sm text-slate-600">ยอดรวม</span>
                    <span className="text-xl font-semibold text-slate-900">
                      {Number(r.total || 0).toFixed(2)}
                    </span>
                  </div>
                  {r.invoice_id != null ? (
                    <p className="text-xs text-slate-500">ใบภาษีซื้อ #{r.invoice_id}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 pt-3">
                  {canApprove ? (
                    <button
                      type="button"
                      onClick={() => loadDetailForEdit(r.id)}
                      disabled={busy}
                      className={`${btnBase} bg-amber-100 text-amber-900 hover:bg-amber-200 disabled:opacity-50`}
                    >
                      แก้ไข
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => createFromExisting(r.id)}
                    disabled={busy}
                    className={`${btnBase} bg-slate-100 text-slate-800 hover:bg-slate-200`}
                  >
                    สร้างใหม่จากใบนี้
                  </button>
                  {canCancel ? (
                    <button
                      type="button"
                      onClick={() => cancelPO(r.id)}
                      disabled={busy}
                      className={`${btnBase} border border-red-200 bg-red-50 text-red-800 hover:bg-red-100`}
                    >
                      ยกเลิก
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => approvePO(r.id)}
                    disabled={busy || !canApprove}
                    className={`${btnBase} bg-blue-100 text-blue-900 hover:bg-blue-200`}
                  >
                    อนุมัติ
                  </button>
                  {canReceive ? (
                    <button
                      type="button"
                      onClick={() => receivePO(r.id)}
                      disabled={busy}
                      className={`${btnBase} bg-amber-100 text-amber-900 hover:bg-amber-200`}
                    >
                      รับของ
                    </button>
                  ) : null}
                  {canPay ? (
                    <button
                      type="button"
                      onClick={() => payPO(r.id)}
                      disabled={busy}
                      className={`${btnBase} bg-emerald-100 text-emerald-900 hover:bg-emerald-200`}
                    >
                      ชำระเงิน
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openPoPdf(r.id)}
                    disabled={busy}
                    className={`${btnBase} bg-slate-100 text-slate-800 hover:bg-slate-200`}
                  >
                    ดาวน์โหลด PDF
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-700">
            <tr>
              <th className="px-3 py-2">สถานะ</th>
              <th className="px-3 py-2">วันที่</th>
              <th className="px-3 py-2">เอกสาร</th>
              <th className="px-3 py-2">ผู้ขาย</th>
              <th className="px-3 py-2 text-right">ยอดรวม</th>
              <th className="px-3 py-2">ใบภาษีซื้อ</th>
              <th className="min-w-[240px] px-3 py-2">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={7}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={7}>
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const { st, busy, isCancelled, isTerminal, canApprove, canReceive, canPay, canCancel } =
                  getPORowState(r, actionId)
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 align-middle">
                      <div className="flex flex-wrap items-center gap-1">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(st)}`}
                        >
                          {poStatusLabel(st)}
                        </span>
                        {isCancelled ? (
                          <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            ยกเลิกแล้ว
                          </span>
                        ) : isTerminal ? (
                          <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            ล็อกแล้ว
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {r.issue_date
                        ? String(r.issue_date).slice(0, 10)
                        : r.doc_date
                          ? String(r.doc_date).slice(0, 10)
                          : r.created_at
                            ? String(r.created_at).slice(0, 10)
                            : '-'}
                    </td>
                    <td className="px-3 py-2">{r.doc_no || '-'}</td>
                    <td className="px-3 py-2">{r.supplier_name}</td>
                    <td className="px-3 py-2 text-right">{Number(r.total || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {r.invoice_id != null ? `#${r.invoice_id}` : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {canApprove ? (
                          <button
                            type="button"
                            onClick={() => loadDetailForEdit(r.id)}
                            disabled={busy}
                            className="rounded bg-amber-100 px-2 py-1 text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                          >
                            แก้ไข
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => createFromExisting(r.id)}
                          disabled={busy}
                          className="rounded bg-slate-100 px-2 py-1 text-slate-800 hover:bg-slate-200 disabled:opacity-40"
                        >
                          สร้างใหม่จากใบนี้
                        </button>
                        {canCancel ? (
                          <button
                            type="button"
                            onClick={() => cancelPO(r.id)}
                            disabled={busy}
                            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-red-800 hover:bg-red-100 disabled:opacity-40"
                          >
                            ยกเลิก
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            console.log('APPROVE CLICK:', r.id)
                            approvePO(r.id)
                          }}
                          disabled={busy || !canApprove}
                          className="rounded bg-blue-100 px-2 py-1 text-blue-900 hover:bg-blue-200 disabled:opacity-40"
                        >
                          อนุมัติ
                        </button>
                        {canReceive ? (
                          <button
                            type="button"
                            onClick={() => receivePO(r.id)}
                            disabled={busy}
                            className="rounded bg-amber-100 px-2 py-1 text-amber-900 hover:bg-amber-200 disabled:opacity-40"
                          >
                            รับของ
                          </button>
                        ) : null}
                        {canPay ? (
                          <button
                            type="button"
                            onClick={() => payPO(r.id)}
                            disabled={busy}
                            className="rounded bg-emerald-100 px-2 py-1 text-emerald-900 hover:bg-emerald-200 disabled:opacity-40"
                          >
                            ชำระเงิน
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openPoPdf(r.id)}
                          disabled={busy}
                          className="rounded bg-slate-100 px-2 py-1 text-slate-800 hover:bg-slate-200 disabled:opacity-40"
                        >
                          ดาวน์โหลด PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showSupplierModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">เพิ่มผู้ขาย</h2>
            <div className="grid gap-3">
              <input
                type="text"
                placeholder="ชื่อผู้ขาย"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <textarea
                placeholder="ที่อยู่"
                rows={3}
                value={newSupplierAddress}
                onChange={(e) => setNewSupplierAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                type="text"
                placeholder="เบอร์โทร"
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
              <input
                type="text"
                placeholder="เลขผู้เสียภาษี"
                value={newSupplierTaxId}
                onChange={(e) => setNewSupplierTaxId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 sm:w-auto"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={supplierSubmitting}
                onClick={createSupplierFromModal}
                className="min-h-11 w-full rounded-lg bg-slate-900 px-4 py-3 text-white disabled:opacity-60 sm:w-auto"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
