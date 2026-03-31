import { useCallback, useEffect, useState } from 'react'
import api from '../services/api.js'

const API_SUPPLIERS = '/api/suppliers'

export default function Suppliers() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')

  const clearForm = useCallback(() => {
    setEditingId(null)
    setName('')
    setAddress('')
    setPhone('')
    setTaxId('')
  }, [])

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(API_SUPPLIERS)
      const list = Array.isArray(data) ? data : data?.suppliers || []
      setRows(list)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      alert('กรุณากรอกชื่อผู้ขาย')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        tax_id: taxId.trim(),
      }
      if (editingId) {
        await api.put(`${API_SUPPLIERS}/${editingId}`, payload)
      } else {
        await api.post(API_SUPPLIERS, payload)
      }
      clearForm()
      await fetchSuppliers()
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  function handleEdit(r) {
    setEditingId(r.id)
    setName(r.name != null ? String(r.name) : '')
    setAddress(r.address != null ? String(r.address) : '')
    setPhone(r.phone != null ? String(r.phone) : '')
    setTaxId(r.tax_id != null ? String(r.tax_id) : '')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('ยืนยันการลบผู้ขาย?')) return
    try {
      console.log('DELETE SUPPLIER:', id)
      await api.delete(`${API_SUPPLIERS}/${id}`)
      alert('ลบผู้ขายสำเร็จ')
      if (editingId === id) clearForm()
      await fetchSuppliers()
    } catch (err) {
      console.error('DELETE SUPPLIER ERROR:', err?.response?.data || err)
      alert('ลบไม่สำเร็จ: ' + (err?.response?.data?.error || err?.message))
    }
  }

  return (
    <div className="flex min-h-svh flex-col gap-8 py-8 md:py-10">
      <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">ผู้ขาย</h1>

      <form
        onSubmit={handleSubmit}
        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-sm text-slate-600">ชื่อผู้ขาย</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">เบอร์โทร</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
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
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-slate-600">ที่อยู่</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
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
            {editingId ? 'อัปเดตผู้ขาย' : 'เพิ่มผู้ขาย'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={clearForm}
              className="ml-2 rounded-lg border border-slate-200 px-4 py-2"
            >
              ยกเลิก
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-700">
            <tr>
              <th className="px-3 py-2">ชื่อผู้ขาย</th>
              <th className="px-3 py-2">ที่อยู่</th>
              <th className="px-3 py-2">เบอร์โทร</th>
              <th className="px-3 py-2">เลขภาษี</th>
              <th className="px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={5}>
                  กำลังโหลด...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-500" colSpan={5}>
                  ไม่มีข้อมูล
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.name || '-'}</td>
                  <td className="px-3 py-2">{r.address || '-'}</td>
                  <td className="px-3 py-2">{r.phone || '-'}</td>
                  <td className="px-3 py-2">{r.tax_id || '-'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleEdit(r)}
                      className="mr-2 rounded bg-amber-100 px-2 py-1 text-amber-900 hover:bg-amber-200"
                    >
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
                      className="rounded bg-red-100 px-2 py-1 text-red-800 hover:bg-red-200"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
