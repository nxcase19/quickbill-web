import { useState, useEffect, useCallback } from 'react'
import api from '../services/api.js'
import { openPdfInNewTab } from '../utils/openPdfWithAuth.js'

const groupByOrder = (docs) => {
  const map = {}

  for (const doc of docs) {
    if (!map[doc.order_id]) {
      map[doc.order_id] = []
    }
    map[doc.order_id].push(doc)
  }

  return Object.values(map)
}

export default function History() {
  const [filter, setFilter] = useState('all')
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    orderId: null,
    amount: 0,
  })
  const [groupedDocs, setGroupedDocs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDocuments = useCallback(async () => {
    const params = {}
    if (filter === 'outstanding') params.status = 'outstanding'
    if (filter === 'paid') params.status = 'paid'
    if (q.trim()) params.q = q.trim()
    try {
      const { data } = await api.get('/api/documents', { params })
      const rows = Array.isArray(data) ? data : data?.documents || []
      setGroupedDocs(groupByOrder(rows))
    } catch {
      setGroupedDocs([])
    }
  }, [filter, q])

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 350)
    return () => clearTimeout(t)
  }, [qInput])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await fetchDocuments()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filter, q, fetchDocuments])

  const openPaymentModal = (group) => {
    if (isOrderCancelled(group)) return
    const invoiceDoc = group.find((d) => d.doc_type === 'INV')
    const total = invoiceDoc ? Number(invoiceDoc.total || 0) : 0

    setPaymentModal({
      open: true,
      orderId: group[0].order_id,
      amount: total,
    })
  }

  const handleOpenPayment = (orderId) => {
    const docs = groupedDocs.find((g) => g[0]?.order_id === orderId)
    if (docs) openPaymentModal(docs)
  }

  const isOrderCancelled = (group) =>
    Array.isArray(group) &&
    group.some(
      (d) => String(d?.status || '').toLowerCase() === 'cancelled',
    )

  const isOrderLocked = (group) =>
    Array.isArray(group) && group.some((d) => d.is_locked === true)

  const orderTotal = (group) => {
    const invoiceDoc = group.find((d) => d.doc_type === 'INV')
    return invoiceDoc ? Number(invoiceDoc.total || 0) : 0
  }

  const orderStatusLabel = (orderCancelled, orderLocked, isOrderPaid) => {
    if (orderCancelled) return 'ยกเลิก'
    if (orderLocked) return 'ล็อก'
    if (isOrderPaid) return 'ชำระแล้ว'
    return 'ค้างชำระ'
  }

  const cancelOrder = async (orderId) => {
    if (
      !window.confirm(
        'คุณต้องการยกเลิกออเดอร์นี้หรือไม่? เอกสารทั้งหมดในออเดอร์จะถูกยกเลิกด้วย',
      )
    ) {
      return
    }
    try {
      await api.post(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
        cancel_reason: '',
      })
      alert('ยกเลิกออเดอร์แล้ว')
      await fetchDocuments()
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'ยกเลิกไม่สำเร็จ')
    }
  }

  const handleOpenPdf = (doc) => {
    openPdfInNewTab(`/api/documents/${encodeURIComponent(doc.id)}/pdf`)
  }

  return (
    <div className="flex min-h-svh flex-col gap-6 py-8 md:py-10">
      <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">บิลทั้งหมด</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`min-h-11 w-full rounded-xl px-6 py-3 text-base font-medium transition sm:min-h-12 sm:w-auto sm:py-4 sm:text-lg ${
            filter === 'all'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
          }`}
        >
          ทั้งหมด
        </button>
        <button
          type="button"
          onClick={() => setFilter('outstanding')}
          className={`min-h-11 w-full rounded-xl px-6 py-3 text-base font-medium transition sm:min-h-12 sm:w-auto sm:py-4 sm:text-lg ${
            filter === 'outstanding'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
          }`}
        >
          🔴 บิลค้างชำระ
        </button>
        <button
          type="button"
          onClick={() => setFilter('paid')}
          className={`min-h-11 w-full rounded-xl px-6 py-3 text-base font-medium transition sm:min-h-12 sm:w-auto sm:py-4 sm:text-lg ${
            filter === 'paid'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
          }`}
        >
          ✅ จ่ายแล้ว
        </button>
      </div>

      <input
        type="search"
        value={qInput}
        onChange={(e) => setQInput(e.target.value)}
        placeholder="ค้นหาเลขบิล / ชื่อลูกค้า"
        className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-800 focus:border-slate-400 focus:outline-none sm:min-h-12 sm:text-lg"
        autoComplete="off"
      />

      {loading ? (
        <p className="py-8 text-center text-slate-500">กำลังโหลด…</p>
      ) : groupedDocs.length === 0 ? (
        <p className="py-8 text-center text-slate-500">ไม่มีรายการ</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-left text-slate-700">
                <tr>
                  <th className="px-3 py-2">เลขที่ / ออเดอร์</th>
                  <th className="px-3 py-2">ลูกค้า</th>
                  <th className="px-3 py-2">สถานะ</th>
                  <th className="px-3 py-2 text-right">ยอดรวม</th>
                  <th className="min-w-[200px] px-3 py-2">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {groupedDocs.map((group) => {
                  const docs = group
                  const first = group[0]
                  const orderId = first?.order_id
                  const isOrderPaid = docs.every(
                    (doc) => Number(doc.paid_amount) >= Number(doc.total),
                  )
                  const orderCancelled = isOrderCancelled(docs)
                  const orderLocked = isOrderLocked(docs)
                  const total = orderTotal(docs)
                  const statusText = orderStatusLabel(orderCancelled, orderLocked, isOrderPaid)
                  const docNo = first.doc_no != null ? String(first.doc_no) : '—'

                  return (
                    <tr key={first.order_id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono font-medium">{docNo}</td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-slate-800">
                        {first.customer_name}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                          {statusText}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{total.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {group.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => handleOpenPdf(doc)}
                              className={`rounded px-2 py-1 text-xs font-medium ${
                                isOrderPaid
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              }`}
                            >
                              PDF {doc.doc_type}
                            </button>
                          ))}
                          {isOrderPaid ? (
                            <span className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                              ชำระแล้ว
                            </span>
                          ) : orderCancelled || orderLocked ? null : (
                            <button
                              type="button"
                              onClick={() => handleOpenPayment(orderId)}
                              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                            >
                              รับเงิน
                            </button>
                          )}
                          {!orderCancelled &&
                          !orderLocked &&
                          !isOrderPaid &&
                          orderId != null &&
                          String(orderId).trim() !== '' ? (
                            <button
                              type="button"
                              onClick={() => cancelOrder(orderId)}
                              className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100"
                            >
                              ยกเลิก
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 md:hidden">
            {groupedDocs.map((group) => {
              const docs = group
              const first = group[0]
              const orderId = first?.order_id
              const isOrderPaid = docs.every(
                (doc) => Number(doc.paid_amount) >= Number(doc.total),
              )
              const orderCancelled = isOrderCancelled(docs)
              const orderLocked = isOrderLocked(docs)
              const total = orderTotal(docs)
              const statusText = orderStatusLabel(orderCancelled, orderLocked, isOrderPaid)

              return (
                <div key={first.order_id} className="card">
                  <div className="flex flex-col gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          เลขที่ / ออเดอร์
                        </p>
                        <p className="font-mono text-lg font-semibold text-slate-900">
                          {first.doc_no != null ? String(first.doc_no) : '—'}
                        </p>
                      </div>
                      <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                        {statusText}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">ลูกค้า: {first.customer_name}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-sm text-slate-600">ยอดรวม</span>
                      <span className="text-xl font-semibold text-slate-900">{total.toFixed(2)}</span>
                    </div>
                    {orderCancelled ? (
                      <div className="inline-block w-fit rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
                        ยกเลิกแล้ว
                      </div>
                    ) : orderLocked ? (
                      <div className="inline-block w-fit rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                        ล็อกแล้ว
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    {group.map((doc) => (
                      <div key={doc.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 text-sm text-slate-700">
                          {doc.doc_type} — {doc.doc_no}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenPdf(doc)}
                          className={`min-h-11 w-full shrink-0 rounded-lg px-3 py-2 text-center text-sm font-medium sm:w-auto ${
                            isOrderPaid
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          }`}
                        >
                          PDF
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    {isOrderPaid ? (
                      <div className="min-h-11 rounded-lg bg-green-100 py-3 text-center text-base font-semibold text-green-700">
                        ชำระแล้ว
                      </div>
                    ) : orderCancelled || orderLocked ? null : (
                      <button
                        type="button"
                        onClick={() => handleOpenPayment(orderId)}
                        className="min-h-11 w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700"
                      >
                        รับเงิน
                      </button>
                    )}
                    {!orderCancelled && !orderLocked && !isOrderPaid && orderId != null && String(orderId).trim() !== '' ? (
                      <button
                        type="button"
                        onClick={() => cancelOrder(orderId)}
                        className="min-h-11 w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-800 hover:bg-red-100"
                      >
                        ยกเลิกออเดอร์
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {paymentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold">รับชำระเงิน</h2>

            <div className="mb-3">
              <label className="mb-1 block text-sm font-medium text-slate-700">จำนวนเงิน</label>
              <input
                className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
                value={paymentModal.amount}
                onChange={(e) =>
                  setPaymentModal({
                    ...paymentModal,
                    amount: e.target.value,
                  })
                }
              />
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                className="min-h-11 flex-1 rounded-lg bg-slate-200 px-4 py-3 text-base font-medium hover:bg-slate-300"
                onClick={() => setPaymentModal({ open: false })}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                className="min-h-11 flex-1 rounded-lg bg-green-600 px-4 py-3 text-base font-medium text-white hover:bg-green-700"
                onClick={async () => {
                  try {
                    await api.post('/api/payments/group', {
                      order_id: paymentModal.orderId,
                      amount: paymentModal.amount,
                    })

                    alert('รับเงินสำเร็จ')

                    setPaymentModal({ open: false })

                    await fetchDocuments()
                  } catch (err) {
                    console.error(err)
                    alert(err?.response?.data?.error || 'รับเงินไม่สำเร็จ')
                  }
                }}
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
