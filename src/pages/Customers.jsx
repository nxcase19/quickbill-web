import { useState, useEffect } from 'react'
import api from '../services/api.js'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [taxId, setTaxId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function fetchCustomers() {
    setLoading(true)
    try {
      const { data } = await api.get('/api/customers')
      const list = Array.isArray(data) ? data : data?.customers || []
      setCustomers(list)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName === '') return
    setSubmitting(true)
    try {
      const payload = {
        name: trimmedName,
        phone,
        address,
        tax_id: taxId,
      }
      console.log('CREATE CUSTOMER PAYLOAD:', payload)
      if (editingId) {
        await api.put(`/api/customers/${editingId}`, payload)
      } else {
        await api.post('/api/customers', payload)
      }
      setName('')
      setPhone('')
      setAddress('')
      setTaxId('')
      setEditingId(null)
      setShowForm(false)
      await fetchCustomers()
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || err?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      console.log('DELETE ID:', id)
      await api.delete(`/api/customers/${id}`)
      fetchCustomers()
    } catch (err) {
      console.error(err)
    }
  }

  function handleEdit(c) {
    setEditingId(c.id)
    setName(c.name ?? '')
    setPhone(c.phone ?? '')
    setAddress(c.address ?? '')
    setTaxId(c.tax_id ?? '')
    setShowForm(true)
  }

  return (
    <div className="flex min-h-svh flex-col gap-8 py-8 md:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
          ลูกค้าประจำ
        </h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-11 w-full rounded-xl bg-slate-900 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-slate-800 sm:w-auto sm:py-4 sm:text-lg"
        >
          + เพิ่มลูกค้า
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
              ชื่อ (required)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-700">
              เบอร์โทร
            </label>
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-slate-700">
              ที่อยู่
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="taxId" className="mb-1.5 block text-sm font-medium text-slate-700">
              เลขผู้เสียภาษี
            </label>
            <input
              id="taxId"
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 w-full rounded-xl bg-slate-900 px-6 py-3 text-base font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 sm:text-lg"
          >
            {submitting ? 'กำลังบันทึก…' : editingId ? 'อัปเดต' : 'บันทึก'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="py-8 text-center text-slate-500">กำลังโหลด…</p>
      ) : customers.length === 0 ? (
        <p className="py-8 text-center text-slate-500">ยังไม่มีลูกค้า</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="px-3 py-2">ชื่อ</th>
                  <th className="px-3 py-2">เบอร์โทร</th>
                  <th className="px-3 py-2">ที่อยู่</th>
                  <th className="min-w-[140px] px-3 py-2">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="px-3 py-2 text-slate-700">{c.phone || '-'}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-slate-600">{c.address || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(c)}
                          className="edit-btn rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          className="delete-btn rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          ลบ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 md:hidden">
            {customers.map((c) => (
              <div
                key={c.id}
                className="customer-row rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="border-b border-slate-100 pb-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">ชื่อ</p>
                  <p className="text-lg font-semibold text-slate-900">{c.name}</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p>
                      <span className="text-slate-500">เบอร์โทร:</span> {c.phone || '-'}
                    </p>
                    {c.address ? (
                      <p className="line-clamp-2">
                        <span className="text-slate-500">ที่อยู่:</span> {c.address}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(c)}
                    className="edit-btn min-h-11 w-full rounded-lg border border-amber-200 bg-white px-4 py-3 text-base font-medium text-amber-700 transition hover:bg-amber-50"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="delete-btn min-h-11 w-full rounded-lg border border-red-200 bg-white px-4 py-3 text-base font-medium text-red-600 transition hover:bg-red-50"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
