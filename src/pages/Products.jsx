import { useState, useEffect } from 'react'
import api from '../services/api.js'

export default function Products() {
  const [products, setProducts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [defaultPrice, setDefaultPrice] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function fetchProducts() {
    setLoading(true)
    try {
      const { data } = await api.get('/api/products')
      const list = Array.isArray(data) ? data : data?.products || []
      setProducts(list)
    } catch {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    try {
      const priceNum = defaultPrice === '' ? 0 : Number(defaultPrice)
      await api.post('/api/products', {
        name: name.trim(),
        defaultPrice: Number.isFinite(priceNum) ? priceNum : 0,
      })
      setName('')
      setDefaultPrice('')
      setShowForm(false)
      fetchProducts()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/products/${id}`)
      fetchProducts()
    } catch {
      // ignore
    }
  }

  function displayPrice(p) {
    const v = p.default_price ?? p.defaultPrice
    if (v == null || v === '') return '-'
    return String(v)
  }

  return (
    <div className="flex min-h-svh flex-col gap-8 py-8 md:py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
          สินค้า / บริการ
        </h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 rounded-xl bg-slate-900 px-6 py-4 text-lg font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          + เพิ่มรายการ
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="p-name" className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อ (required)
            </label>
            <input
              id="p-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="p-price" className="mb-1 block text-sm font-medium text-slate-700">
              defaultPrice
            </label>
            <input
              id="p-price"
              type="number"
              step="any"
              min="0"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-800 focus:border-slate-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-6 py-4 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </form>
      )}

      <div className="flex flex-col gap-4">
        {loading ? (
          <p className="py-8 text-center text-slate-500">กำลังโหลด…</p>
        ) : products.length === 0 ? (
          <p className="py-8 text-center text-slate-500">ยังไม่มีรายการ</p>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-slate-800">{p.name}</p>
                <p className="text-slate-600">{displayPrice(p)}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                ลบ
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
