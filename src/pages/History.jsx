import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../services/api.js'
import { isCancelled, isPaid, isUnpaid } from '../utils/payment.js'

const DOC_ORDER = ['QT', 'DN', 'INV', 'RC']

function getDocType(doc) {
  return String(doc.doc_type || doc.type || doc.document_type || '').trim()
}

function docTypeOrderIndex(doc) {
  const u = getDocType(doc).toUpperCase()
  const i = DOC_ORDER.indexOf(u)
  return i === -1 ? DOC_ORDER.length + 1 : i
}

function sortDocuments(group) {
  return [...group].sort((a, b) => docTypeOrderIndex(a) - docTypeOrderIndex(b))
}

function getDocColor(doc, rc) {
  const type = getDocType(doc).toUpperCase()

  if (type === 'QT') return 'bg-blue-100 text-blue-700 hover:bg-blue-200'
  if (type === 'DN') return 'bg-pink-100 text-pink-700 hover:bg-pink-200'
  if (type === 'INV') return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'

  if (type === 'RC') {
    if (!rc) return 'bg-gray-100 text-gray-500 hover:bg-gray-200'

    const rcPaid =
      Number(rc.paid_amount || 0) >= Number(rc.total_amount || rc.total || 0)

    return rcPaid
      ? 'bg-green-100 text-green-700 hover:bg-green-200'
      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
  }

  return 'bg-gray-100 text-gray-500 hover:bg-gray-200'
}

/** First non-empty value (order fields may be UUID string, number, or empty string). */
function firstOrderField(...vals) {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return null
}

/**
 * Document number without type prefix, e.g. RC-202604-0194 → 202604-0194
 * Uses doc_no / document_number from API.
 */
function extractOrderKeyFromDocNumber(num) {
  if (num == null || String(num).trim() === '') return null
  const parts = String(num).trim().split('-')
  if (parts.length < 2) return null
  return parts.slice(1).join('-')
}

/**
 * One key per sales order: prefer explicit order links, then shared doc-no suffix.
 * Fallback isolates documents that cannot be grouped.
 */
function getGroupKey(doc) {
  const fromOrder = firstOrderField(
    doc.order_id,
    doc.reference_id,
    doc.group_id,
    doc.root_id,
    doc.parent_id,
  )
  if (fromOrder) return fromOrder

  const docNum = doc.document_number ?? doc.doc_no ?? doc.doc_number
  const fromNum = extractOrderKeyFromDocNumber(docNum)
  if (fromNum) return fromNum

  return `id:${doc.id}`
}

function groupDocuments(documents) {
  const map = {}

  documents.forEach((doc) => {
    const key = getGroupKey(doc)
    if (!map[key]) {
      map[key] = []
    }
    map[key].push(doc)
  })

  return Object.values(map)
}

function getRC(group) {
  return group.find(
    (doc) =>
      doc.doc_type === 'RC' ||
      doc.type === 'RC' ||
      doc.document_type === 'RC',
  )
}

function buildOrderRows(grouped) {
  return grouped.map((group) => {
    const rc = getRC(group)
    const total = rc ? Number(rc.total_amount ?? rc.total ?? 0) : 0
    const paid = rc ? Number(rc.paid_amount ?? 0) : 0
    const outstanding = Math.max(0, total - paid)
    return {
      group,
      rc,
      total,
      paid,
      outstanding,
    }
  })
}

function getOrderStatus(row) {
  const doc = row.rc || row.group[0]

  if (isCancelled(doc)) return 'cancelled'

  if (row.rc && isPaid(row.rc)) return 'paid'

  if (row.rc && isUnpaid(row.rc)) return 'unpaid'

  return 'no_rc'
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
  const [allDocuments, setAllDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDocuments = useCallback(async () => {
    const params = {}
    if (q.trim()) params.q = q.trim()
    try {
      const { data } = await api.get('/api/documents', { params })
      const documents = Array.isArray(data) ? data : data?.documents || []
      setAllDocuments(documents)
    } catch {
      setAllDocuments([])
    }
  }, [q])

  const groupedDocuments = useMemo(
    () => groupDocuments(allDocuments),
    [allDocuments],
  )

  const orderRows = useMemo(
    () => buildOrderRows(groupedDocuments),
    [groupedDocuments],
  )

  const visibleRows = useMemo(() => {
    return (() => {
      if (filter === 'all') {
        return orderRows.filter((r) => !isCancelled(r.rc || r.group[0]))
      }
      if (filter === 'paid') {
        return orderRows.filter((r) => r.rc && isPaid(r.rc))
      }
      if (filter === 'outstanding') {
        return orderRows.filter((r) => r.rc && isUnpaid(r.rc))
      }
      return orderRows
    })()
  }, [orderRows, filter])

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
  }, [q, fetchDocuments])

  const openPaymentModal = (r) => {
    const { group, rc, total } = r
    if (isOrderCancelled(group)) return
    if (!rc || !isUnpaid(rc)) return

    setPaymentModal({
      open: true,
      orderId: group[0].order_id,
      amount: total,
    })
  }

  const handleOpenPayment = (orderId) => {
    const row = visibleRows.find((r) => r.group[0]?.order_id === orderId)
    if (row) openPaymentModal(row)
  }

  const isOrderCancelled = (group) =>
    Array.isArray(group) &&
    group.some(
      (d) => String(d?.status || '').toLowerCase() === 'cancelled',
    )

  const isOrderLocked = (group) =>
    Array.isArray(group) && group.some((d) => d.is_locked === true)

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
    const token = localStorage.getItem('token')
    const API_URL = import.meta.env.VITE_API_URL || ''
    const id = doc.id
    const url = `${API_URL}/api/documents/${id}/pdf?token=${token}`
    window.open(url, '_blank')
  }

  const rowReactKey = (r) => {
    const first = r.group[0]
    return String(first?.group_id ?? first?.order_id ?? first?.id ?? '')
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

      <p className="text-sm text-slate-500">
        ยอดเงินแสดงตามใบเสร็จ (RC) เท่านั้น — แสดงเอกสารทุกใบในออเดอร์
      </p>

      {loading ? (
        <p className="py-8 text-center text-slate-500">กำลังโหลด…</p>
      ) : visibleRows.length === 0 ? (
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
                  <th className="px-3 py-2 text-right">ยอดรวม (RC)</th>
                  <th className="min-w-[200px] px-3 py-2">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => {
                  const { group, rc, total, outstanding } = r
                  const first = group[0]
                  const orderId = first?.order_id
                  const orderCancelled = isOrderCancelled(group)
                  const orderLocked = isOrderLocked(group)
                  const orderStatus = getOrderStatus(r)
                  const docNo = first.doc_no != null ? String(first.doc_no) : '—'
                  const showReceivePayment =
                    rc && isUnpaid(rc) && !orderCancelled && !orderLocked

                  return (
                    <tr key={rowReactKey(r)} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono font-medium">{docNo}</td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-slate-800">
                        {first.customer_name}
                      </td>
                      <td className="px-3 py-2">
                        {orderStatus === 'paid' && (
                          <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            ชำระแล้ว
                          </span>
                        )}
                        {orderStatus === 'unpaid' && (
                          <span className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                            ค้างชำระ
                          </span>
                        )}
                        {orderStatus === 'cancelled' && (
                          <span className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
                            ยกเลิก
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {total.toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {sortDocuments(group).map((doc) => {
                            const type = getDocType(doc).toUpperCase() || '—'
                            return (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => handleOpenPdf(doc)}
                                className={`rounded px-2 py-1 text-xs font-medium transition ${getDocColor(doc, rc)}`}
                              >
                                {type}
                              </button>
                            )
                          })}
                          {showReceivePayment ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPayment(orderId)}
                              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                            >
                              รับเงิน
                            </button>
                          ) : null}
                          {!orderCancelled &&
                          !orderLocked &&
                          rc &&
                          isUnpaid(rc) &&
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
            {visibleRows.map((r) => {
              const { group, rc, total, outstanding } = r
              const first = group[0]
              const orderId = first?.order_id
              const orderCancelled = isOrderCancelled(group)
              const orderLocked = isOrderLocked(group)
              const orderStatus = getOrderStatus(r)
              const showReceivePayment =
                rc && isUnpaid(rc) && !orderCancelled && !orderLocked

              return (
                <div key={rowReactKey(r)} className="card">
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
                      <div className="flex flex-wrap justify-end gap-1">
                        {orderStatus === 'paid' && (
                          <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            ชำระแล้ว
                          </span>
                        )}
                        {orderStatus === 'unpaid' && (
                          <span className="rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                            ค้างชำระ
                          </span>
                        )}
                        {orderStatus === 'cancelled' && (
                          <span className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
                            ยกเลิก
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">ลูกค้า: {first.customer_name}</p>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-sm text-slate-600">ยอดรวม (RC)</span>
                      <span className="text-xl font-semibold text-slate-900">
                        {total.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {sortDocuments(group).map((doc) => {
                      const type = getDocType(doc).toUpperCase() || '—'
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => handleOpenPdf(doc)}
                          className={`min-h-11 rounded-lg px-4 py-2 text-center text-sm font-medium transition sm:min-h-0 ${getDocColor(doc, rc)}`}
                        >
                          {type}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-4 flex flex-col gap-2">
                    {showReceivePayment ? (
                      <button
                        type="button"
                        onClick={() => handleOpenPayment(orderId)}
                        className="min-h-11 w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-medium text-white hover:bg-blue-700"
                      >
                        รับเงิน
                      </button>
                    ) : null}
                    {!orderCancelled &&
                    !orderLocked &&
                    rc &&
                    isUnpaid(rc) &&
                    orderId != null &&
                    String(orderId).trim() !== '' ? (
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
