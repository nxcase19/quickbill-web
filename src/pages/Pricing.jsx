import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getStoredToken } from '../utils/authClient.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
if (!API_BASE_URL) {
  console.warn('VITE_API_URL is not set')
}

const PLANS = [
  {
    id: 'free',
    name: 'FREE',
    price: '0฿',
    sub: 'เริ่มต้นใช้งาน',
    features: [
      '5 เอกสาร / วัน',
      'สูงสุด 50 ฉบับ / เดือน',
      'มี watermark บน PDF',
      'ไม่มี Export',
      'ไม่มีใบสั่งซื้อ (PO)',
    ],
    cta: 'ใช้งานแพ็กเกจนี้',
    ctaVariant: 'secondary',
  },
  {
    id: 'basic',
    name: 'BASIC',
    price: '99฿',
    sub: '/ เดือน',
    features: ['เอกสารไม่จำกัด', 'Export Excel / ภาษี', 'ไม่มี PO / ภาษีซื้อขั้นสูง'],
    cta: 'อัปเกรด',
    ctaVariant: 'primary',
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '199฿',
    sub: '/ เดือน',
    recommended: true,
    features: ['ทุกฟีเจอร์', 'Export ครบ', 'ใบสั่งซื้อ', 'ภาษีซื้อ', 'ไม่ watermark (หลัง trial)'],
    cta: 'อัปเกรด',
    ctaVariant: 'primary',
  },
  {
    id: 'business',
    name: 'BUSINESS',
    price: '399฿',
    sub: '/ เดือน',
    features: ['เหมือน PRO', 'รองรับหลายผู้ใช้ (เร็วๆ นี้)'],
    cta: 'อัปเกรด',
    ctaVariant: 'primary',
  },
]

export default function Pricing() {
  const [loadingId, setLoadingId] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)

  async function startCheckout(planId) {
    const token = getStoredToken()
    if (!token) {
      window.alert('กรุณาเข้าสู่ระบบก่อนชำระเงิน')
      return
    }
    setCheckoutError(null)
    setLoadingId(planId)
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_type: planId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success || typeof data.url !== 'string') {
        const msg =
          (typeof data?.error === 'string' && data.error) ||
          `ไม่สามารถเปิดหน้าชำระเงินได้ (${res.status})`
        throw new Error(msg)
      }
      window.location.href = data.url
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'เกิดข้อผิดพลาด'
      setCheckoutError(msg)
      window.alert(msg)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="flex min-h-svh flex-col gap-10 py-8 md:py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">แพ็กเกจ & ราคา</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 sm:text-base">
          ชำระผ่านบัตรด้วย Stripe Checkout — รองรับ SaaS จริง (รายเดือน) ราคาเป็นแนวทางและอาจปรับก่อนเปิดบริการ
        </p>
        {checkoutError ? (
          <p className="mx-auto mt-3 max-w-lg text-xs text-red-600" role="alert">
            {checkoutError}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition ${
              plan.recommended
                ? 'border-amber-400 ring-2 ring-amber-400/40'
                : 'border-slate-200'
            }`}
          >
            {plan.recommended ? (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-bold text-white shadow">
                แนะนำ
              </span>
            ) : null}
            <div className="mb-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {plan.name}
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                {plan.sub ? (
                  <span className="text-sm text-slate-500">{plan.sub}</span>
                ) : null}
              </p>
            </div>
            <ul className="mb-6 flex flex-1 flex-col gap-2 text-sm text-slate-600">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {plan.ctaVariant === 'secondary' ? (
              <Link
                to="/dashboard"
                className="min-h-11 w-full rounded-xl border-2 border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                {plan.cta}
              </Link>
            ) : (
              <button
                type="button"
                disabled={loadingId != null}
                onClick={() => startCheckout(plan.id)}
                className={`min-h-11 w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md transition disabled:opacity-60 ${
                  plan.recommended
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {loadingId === plan.id ? 'กำลังเปิดหน้าชำระเงิน…' : plan.cta}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-500">
        การสมัครสมาชิกต่ออายุอัตโนมัติตามเงื่อนไข Stripe — ยกเลิกได้จากพอร์ทัลลูกค้าของ Stripe
      </p>
    </div>
  )
}
