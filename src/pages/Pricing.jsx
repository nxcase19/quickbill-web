import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getStoredToken } from '../utils/authClient.js'
import { useBilling } from '../context/BillingContext.jsx'

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

/** @type {Record<string, number>} */
const TIER_RANK = Object.freeze({
  free: 0,
  trial: 1,
  basic: 2,
  pro: 3,
  business: 4,
})

const PAID_CARD_IDS = new Set(['basic', 'pro', 'business'])

/**
 * Stored / effective tier for comparing pricing columns (not backend API).
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {'free'|'trial'|'basic'|'pro'|'business'}
 */
function currentTierFromBilling(data) {
  if (!data) return 'free'
  const pt = String(data.planType ?? '').toLowerCase()
  const eff = String(data.effectivePlan ?? '').toLowerCase()
  const trialOn =
    data.trialActive === true || eff === 'trial' || pt === 'trial'

  for (const t of /** @type {const} */ (['business', 'pro', 'basic'])) {
    if (pt === t || eff === t) return t
  }
  if (trialOn) return 'trial'
  return 'free'
}

/**
 * @param {'basic'|'pro'|'business'} cardId
 * @param {Record<string, unknown> | null | undefined} billingData
 */
function paidTierButtonState(cardId, billingData) {
  const current = currentTierFromBilling(billingData)
  const cRank = TIER_RANK[current] ?? 0
  const tRank = TIER_RANK[cardId] ?? 0

  if (cardId === current) {
    return { label: 'ใช้งานแพ็กเกจนี้', disabled: true, action: 'current' }
  }
  if (tRank > cRank) {
    return { label: 'อัปเกรด', disabled: false, action: 'upgrade' }
  }
  return { label: 'ดาวน์เกรด', disabled: true, action: 'downgrade' }
}

/**
 * @param {Record<string, unknown> | null | undefined} billingData
 * @param {boolean} isLoggedIn
 */
function freeTierButtonState(billingData, isLoggedIn) {
  const current = currentTierFromBilling(billingData)
  const onFreeOrTrial = current === 'free' || current === 'trial'

  if (!isLoggedIn) {
    return {
      label: 'ทดลองใช้ฟรี',
      to: '/register',
      variant: 'register',
    }
  }
  if (onFreeOrTrial) {
    return { label: 'ใช้งานแพ็กเกจนี้', variant: 'current' }
  }
  return { label: 'ดาวน์เกรด', to: null, variant: 'downgrade' }
}

export default function Pricing() {
  const [searchParams] = useSearchParams()
  const fromTrial = searchParams.get('from') === 'trial'
  const [loadingId, setLoadingId] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const { plan: billingPlanApi, refreshPlan, loading: billingLoading } = useBilling()
  const token = getStoredToken()
  const isLoggedIn = Boolean(token)

  const billingSnapshot = billingPlanApi ?? null

  useEffect(() => {
    if (token) {
      void refreshPlan()
    }
  }, [refreshPlan, token])

  async function startCheckout(planId) {
    const token = getStoredToken()
    if (!token) {
      window.alert('กรุณาเข้าสู่ระบบก่อนชำระเงิน')
      return
    }
    console.log('TOKEN:', token)
    setCheckoutError(null)
    setLoadingId(planId)
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ plan_type: planId }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `ไม่สามารถเปิดหน้าชำระเงินได้ (${res.status})`)
      }

      const data = await res.json().catch(() => ({}))
      if (!data?.success || typeof data.url !== 'string') {
        const msg =
          (typeof data?.error === 'string' && data.error) ||
          'ไม่สามารถเปิดหน้าชำระเงินได้'
        throw new Error(msg)
      }
      window.location.href = data.url
    } catch (e) {
      console.error('BILLING ERROR:', e)
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
              plan.id === 'pro' && fromTrial
                ? 'highlight-pro border-amber-500 ring-2 ring-amber-400/50'
                : plan.recommended
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
              (() => {
                const st = freeTierButtonState(billingSnapshot, isLoggedIn)
                if (st.variant === 'downgrade') {
                  return (
                    <button
                      type="button"
                      disabled
                      className="min-h-11 w-full cursor-not-allowed rounded-xl border-2 border-slate-200 bg-slate-100 py-3 text-center text-sm font-semibold text-slate-500"
                    >
                      {st.label}
                    </button>
                  )
                }
                if (st.variant === 'current') {
                  return (
                    <span
                      className="block min-h-11 w-full cursor-default rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3 text-center text-sm font-semibold text-emerald-800"
                      aria-current="true"
                    >
                      {st.label}
                    </span>
                  )
                }
                return (
                  <Link
                    to={st.to ?? '/register'}
                    className="block min-h-11 w-full rounded-xl border-2 border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {st.label}
                  </Link>
                )
              })()
            ) : (
              (() => {
                if (!PAID_CARD_IDS.has(plan.id)) return null
                const { label, disabled, action } = paidTierButtonState(
                  /** @type {'basic'|'pro'|'business'} */ (plan.id),
                  billingSnapshot,
                )
                const awaitingBilling = billingLoading && billingSnapshot == null
                const btnDisabled = loadingId != null || disabled || awaitingBilling
                const isDowngrade = action === 'downgrade'
                return (
                  <button
                    type="button"
                    disabled={btnDisabled}
                    onClick={() => {
                      if (action === 'upgrade') void startCheckout(plan.id)
                    }}
                    className={`min-h-11 w-full rounded-xl py-3 text-sm font-semibold shadow-md transition disabled:opacity-60 ${
                      isDowngrade
                        ? 'cursor-not-allowed bg-slate-500 text-white hover:bg-slate-500'
                        : plan.recommended
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {loadingId === plan.id
                      ? 'กำลังเปิดหน้าชำระเงิน…'
                      : billingLoading && billingSnapshot == null
                        ? 'กำลังโหลด…'
                        : label}
                  </button>
                )
              })()
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
