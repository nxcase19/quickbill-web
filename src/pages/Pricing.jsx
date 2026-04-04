import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getStoredToken } from '../utils/authClient.js'
import { useBilling } from '../context/BillingContext.jsx'
import { getPersistedAccount, persistAccountFromAuth } from '../utils/planClient.js'

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

const getButtonLabel = (userPlan, planId) => {
  if (userPlan === planId) {
    return 'ใช้งานแพ็กเกจนี้'
  }

  if (userPlan === 'trial' || userPlan === 'free') {
    return 'อัพเกรด'
  }

  return 'เปลี่ยนแพ็กเกจ'
}

/**
 * Map GET /api/auth/me `data` (or persisted account) to a pricing tier.
 * Uses `plan_type` so `business` is distinct from collapsed `plan: 'pro'`.
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {'free'|'trial'|'basic'|'pro'|'business'}
 */
function deriveUserPlanForPricing(data) {
  if (!data || typeof data !== 'object') return 'free'
  const pt = String(data.plan_type ?? '').toLowerCase()
  if (pt === 'business') return 'business'
  if (pt === 'pro') return 'pro'
  if (pt === 'basic') return 'basic'
  if (pt === 'trial') return 'trial'
  if (pt === 'free') return 'free'
  const eff = String(data.plan ?? 'free').toLowerCase()
  if (data.is_trial_active === true || eff === 'trial') return 'trial'
  if (eff === 'basic') return 'basic'
  if (eff === 'pro') return 'pro'
  return 'free'
}

function buildUserFromMePayload(data) {
  if (!data || typeof data !== 'object') return null
  const plan = deriveUserPlanForPricing(data)
  return { ...data, plan }
}

/**
 * @param {'basic'|'pro'|'business'} cardId
 * @param {'free'|'trial'|'basic'|'pro'|'business'|null} userPlan
 */
function paidTierButtonState(cardId, userPlan) {
  if (userPlan === null) {
    return { label: 'กำลังโหลด…', disabled: true, action: 'loading' }
  }
  const cRank = TIER_RANK[userPlan] ?? 0
  const tRank = TIER_RANK[cardId] ?? 0

  if (cardId === userPlan) {
    return { label: 'ใช้งานแพ็กเกจนี้', disabled: true, action: 'current' }
  }
  if (tRank > cRank) {
    return { label: 'อัปเกรด', disabled: false, action: 'upgrade' }
  }
  return { label: 'ดาวน์เกรด', disabled: true, action: 'downgrade' }
}

/**
 * Free column: ทดลอง only when not logged in (never while userPlan is null / loading).
 * @param {'free'|'trial'|'basic'|'pro'|'business'|null} userPlan
 * @param {boolean} isLoggedIn
 */
function freeTierButtonState(userPlan, isLoggedIn) {
  if (userPlan === null) {
    return { variant: 'loading', label: 'กำลังโหลด…' }
  }
  if (!isLoggedIn) {
    return { variant: 'trial_cta', label: 'ทดลองใช้ฟรี', to: '/register' }
  }
  if (userPlan === 'free') {
    return { variant: 'current', label: 'ใช้งานแพ็กเกจนี้' }
  }
  const uRank = TIER_RANK[userPlan] ?? 0
  if (uRank > TIER_RANK.free) {
    return { variant: 'downgrade', label: 'ดาวน์เกรด' }
  }
  return { variant: 'current', label: 'ใช้งานแพ็กเกจนี้' }
}

export default function Pricing() {
  const [searchParams] = useSearchParams()
  const fromTrial = searchParams.get('from') === 'trial'
  const [loadingId, setLoadingId] = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState(null)
  const { refreshPlan } = useBilling()
  const token = getStoredToken()
  const isLoggedIn = Boolean(token)

  const [user, setUser] = useState(() =>
    token ? buildUserFromMePayload(getPersistedAccount()) : null,
  )
  const [meLoading, setMeLoading] = useState(() => Boolean(token))

  const syncUserAndBilling = useCallback(async () => {
    const t = getStoredToken()
    if (!t) {
      setUser(null)
      setMeLoading(false)
      return
    }
    setMeLoading(true)
    try {
      await refreshPlan()
    } catch {
      /* billing context still best-effort */
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me?_t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${t}`,
          'Cache-Control': 'no-store',
        },
        cache: 'no-store',
        credentials: 'include',
      })
      const body = await res.json().catch(() => ({}))
      if (body?.success && body.data && typeof body.data === 'object') {
        const data = /** @type {Record<string, unknown>} */ (body.data)
        persistAccountFromAuth(data)
        setUser(buildUserFromMePayload(data))
      } else {
        setUser(buildUserFromMePayload(getPersistedAccount()))
      }
    } catch {
      setUser(buildUserFromMePayload(getPersistedAccount()))
    } finally {
      setMeLoading(false)
    }
  }, [refreshPlan])

  useEffect(() => {
    void syncUserAndBilling()
  }, [syncUserAndBilling])

  const userPlan =
    /** @type {'free'|'trial'|'basic'|'pro'|'business'|null} */ (
      meLoading ? null : (user?.plan ?? 'free')
    )

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

  async function cancelSubscription() {
    const ok = window.confirm(
      'คุณต้องการยกเลิกแพ็กเกจหรือไม่?\nคุณยังสามารถใช้งานได้จนสิ้นสุดรอบบิล',
    )
    if (!ok) return

    const token = getStoredToken()
    if (!token) {
      window.alert('กรุณาเข้าสู่ระบบ')
      return
    }

    setCancelLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/billing/cancel-subscription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      let data = {}
      try {
        data = await res.json()
      } catch {
        data = {}
      }

      if (!res.ok) {
        const errMsg =
          (typeof data?.error === 'string' && data.error) ||
          `ไม่สามารถยกเลิกได้ (${res.status})`
        throw new Error(errMsg)
      }

      if (!data?.success) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'ยกเลิกไม่สำเร็จ',
        )
      }

      window.alert('ยกเลิกแพ็กเกจสำเร็จ')
      window.location.reload()
    } catch (e) {
      console.error(e)
      window.alert(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ')
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col gap-10 py-8 md:py-12">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">แพ็กเกจ & ราคา</h1>
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
                const st = freeTierButtonState(userPlan, isLoggedIn)
                if (st.variant === 'loading') {
                  return (
                    <button
                      type="button"
                      disabled
                      className="min-h-11 w-full cursor-wait rounded-xl border-2 border-slate-200 bg-slate-50 py-3 text-center text-sm font-semibold text-slate-500"
                    >
                      {st.label}
                    </button>
                  )
                }
                if (st.variant === 'downgrade') {
                  return (
                    <button
                      type="button"
                      disabled
                      className="min-h-11 w-full cursor-not-allowed rounded-xl border-2 border-slate-200 bg-slate-100 py-3 text-center text-sm font-semibold text-slate-500"
                    >
                      {getButtonLabel(userPlan, plan.id)}
                    </button>
                  )
                }
                if (st.variant === 'current') {
                  return (
                    <span
                      className="block min-h-11 w-full cursor-default rounded-xl border-2 border-emerald-200 bg-emerald-50 py-3 text-center text-sm font-semibold text-emerald-800"
                      aria-current="true"
                    >
                      {getButtonLabel(userPlan, plan.id)}
                    </span>
                  )
                }
                return (
                  <Link
                    to={st.to ?? '/register'}
                    className="block min-h-11 w-full rounded-xl border-2 border-slate-200 bg-white py-3 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {getButtonLabel(userPlan, plan.id)}
                  </Link>
                )
              })()
            ) : (
              (() => {
                if (!PAID_CARD_IDS.has(plan.id)) return null
                const { disabled, action } = paidTierButtonState(
                  /** @type {'basic'|'pro'|'business'} */ (plan.id),
                  userPlan,
                )
                const btnDisabled = loadingId != null || disabled
                const isDowngrade = action === 'downgrade'
                const isLoading = action === 'loading'
                const showCancelSubscription = action === 'current'
                return (
                  <>
                    <button
                      type="button"
                      disabled={btnDisabled}
                      onClick={() => {
                        if (action === 'upgrade') void startCheckout(plan.id)
                      }}
                      className={`min-h-11 w-full rounded-xl py-3 text-sm font-semibold shadow-md transition disabled:opacity-60 ${
                        isLoading
                          ? 'cursor-wait bg-slate-200 text-slate-600 hover:bg-slate-200'
                          : isDowngrade
                            ? 'cursor-not-allowed bg-slate-500 text-white hover:bg-slate-500'
                            : plan.recommended
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {loadingId === plan.id
                        ? 'กำลังเปิดหน้าชำระเงิน…'
                        : userPlan === null
                          ? 'กำลังโหลด…'
                          : getButtonLabel(userPlan, plan.id)}
                    </button>
                    {showCancelSubscription ? (
                      <>
                        <button
                          type="button"
                          disabled={cancelLoading}
                          onClick={() => void cancelSubscription()}
                          className="mt-2 w-full rounded-xl bg-red-500 px-4 py-2 text-white transition hover:bg-red-600 disabled:opacity-60"
                        >
                          {cancelLoading ? 'กำลังดำเนินการ…' : 'ยกเลิกใช้บริการ'}
                        </button>
                        <p className="mt-1 text-center text-xs text-gray-500">
                          คุณยังสามารถใช้งานได้จนสิ้นสุดรอบบิล
                        </p>
                      </>
                    ) : null}
                  </>
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
