/**
 * Unified payment / outstanding math for sales documents.
 * Uses amounts (total, paid_amount) + workflow cancelled; do not use status for paid/pending.
 */

function docTotal(doc) {
  return Number(doc?.total_amount ?? doc?.total ?? 0)
}

function docPaid(doc) {
  return Number(doc?.paid_amount ?? 0)
}

/** Workflow cancellation (not financial paid/unpaid). */
export function isCancelled(doc) {
  return String(doc?.status ?? '').toLowerCase() === 'cancelled'
}

/**
 * @returns {'cancelled' | 'paid' | 'unpaid'}
 */
export function getPaymentStatus(doc) {
  if (!doc) return 'unpaid'
  if (isCancelled(doc)) return 'cancelled'
  const total = docTotal(doc)
  const paid = docPaid(doc)
  if (paid >= total) return 'paid'
  return 'unpaid'
}

export function getOutstandingAmount(doc) {
  if (!doc || isCancelled(doc)) return 0
  const total = docTotal(doc)
  const paid = docPaid(doc)
  return Math.max(0, total - paid)
}

export function isUnpaid(doc) {
  return getPaymentStatus(doc) === 'unpaid'
}

export function isPaid(doc) {
  return getPaymentStatus(doc) === 'paid'
}
