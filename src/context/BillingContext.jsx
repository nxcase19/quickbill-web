import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import LimitModal from '../components/LimitModal.jsx'
import UpgradeModal, { UPGRADE_MODAL_EVENT } from '../components/UpgradeModal.jsx'
import {
  clearBillingPlanCache,
  createDefaultFreePlanSnapshot,
  fetchBillingPlan,
  canUseFeature,
  featuresForEffectivePlan,
  getPersistedAccount,
  planShapeFromAccount,
} from '../utils/planClient.js'
import {
  BILLING_GATED_FEATURE_KEYS,
  hasFullProFeatureAccess,
} from '../utils/planAccess.js'
import { SET_PLAN_EVENT } from '../utils/billingPlanEvents.js'

export { setPlanFromLogin } from '../utils/billingPlanEvents.js'

const BillingContext = createContext(null)

const DEFAULT_UPGRADE = 'ฟีเจอร์นี้ใช้ได้เฉพาะแพ็กเกจ Pro'
const LIMIT_MSG = 'คุณใช้ครบแล้วในวันนี้'

/** Keep last known billing state on API failure; else hydrate from login-persisted account. */
function planStateIfFetchFails(prev) {
  if (prev != null) return prev
  const fromAuth = planShapeFromAccount(getPersistedAccount())
  if (fromAuth) {
    const t = String(fromAuth.plan ?? fromAuth.effectivePlan ?? 'free').toLowerCase()
    return { ...fromAuth, plan: t, effectivePlan: t }
  }
  return createDefaultFreePlanSnapshot()
}

export function BillingProvider({ children }) {
  const [billingPlanData, setBillingPlanData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [limitModalOpen, setLimitModalOpen] = useState(false)
  const [upgradeMessage, setUpgradeMessage] = useState(DEFAULT_UPGRADE)
  const [limitMessage, setLimitMessage] = useState(LIMIT_MSG)

  const fetchPlan = useCallback(async () => {
    if (import.meta.env.VITE_DISABLE_BILLING_FETCH === 'true') {
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchBillingPlan({ force: true })
      if (res == null) {
        console.warn('PLAN FETCH FAILED: billing API returned null')
        setError('Billing plan unavailable')
        setBillingPlanData((prev) => planStateIfFetchFails(prev))
        return null
      }
      const planData = res?.data ?? res ?? createDefaultFreePlanSnapshot()
      const tier = String(
        planData?.plan ?? planData?.effectivePlan ?? 'free',
      ).toLowerCase()
      const normalized = {
        ...planData,
        plan: tier,
        effectivePlan: tier,
      }
      console.log('FETCH PLAN RESULT:', normalized)
      setBillingPlanData(normalized)
      return normalized
    } catch (e) {
      console.warn('PLAN FETCH FAILED:', e)
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setBillingPlanData((prev) => planStateIfFetchFails(prev))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshPlan = fetchPlan

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      clearBillingPlanCache()
      setBillingPlanData(null)
      setError(null)
      return
    }
    if (billingPlanData != null) {
      return
    }
    if (import.meta.env.VITE_DISABLE_BILLING_FETCH === 'true') {
      const shaped = planShapeFromAccount(getPersistedAccount())
      if (shaped) {
        const t = String(shaped.plan ?? shaped.effectivePlan ?? 'free').toLowerCase()
        setBillingPlanData({ ...shaped, plan: t, effectivePlan: t })
      } else {
        setBillingPlanData(createDefaultFreePlanSnapshot())
      }
      return
    }
    void fetchPlan().catch((e) => {
      console.warn('PLAN FETCH FAILED:', e)
      setBillingPlanData((prev) => planStateIfFetchFails(prev))
    })
  }, [billingPlanData, fetchPlan])

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail
      if (!detail) return
      const account = detail.account ?? detail
      const shaped = planShapeFromAccount(account)
      if (shaped) {
        const t = String(shaped.plan ?? shaped.effectivePlan ?? 'free').toLowerCase()
        setBillingPlanData({
          ...shaped,
          plan: t,
          effectivePlan: t,
          planType: String(account.plan_type ?? shaped.planType ?? t).toLowerCase(),
          trialActive: shaped.trialActive,
          trialEndsAt: account.trial_ends_at ?? detail.trialEndsAt ?? null,
          subscriptionEndsAt: account.subscription_ends_at ?? detail.subscriptionEndsAt ?? null,
        })
        return
      }
      const p = String(detail.plan ?? 'free').toLowerCase()
      const base = createDefaultFreePlanSnapshot()
      setBillingPlanData({
        ...base,
        plan: p,
        effectivePlan: p,
        planType: p,
        features: featuresForEffectivePlan(p),
        trialActive: detail.trialActive ?? false,
        trialEndsAt: detail.trialEndsAt ?? null,
        subscriptionEndsAt: detail.subscriptionEndsAt ?? null,
      })
    }
    window.addEventListener(SET_PLAN_EVENT, handler)
    return () => window.removeEventListener(SET_PLAN_EVENT, handler)
  }, [])

  useEffect(() => {
    const onUpgrade = (e) => {
      const reason = e.detail?.reason
      const msg = e.detail?.message
      if (reason === 'LIMIT_REACHED') {
        setLimitMessage(msg || LIMIT_MSG)
        setLimitModalOpen(true)
        setUpgradeModalOpen(false)
      } else {
        setUpgradeMessage(msg || DEFAULT_UPGRADE)
        setUpgradeModalOpen(true)
        setLimitModalOpen(false)
      }
    }
    window.addEventListener(UPGRADE_MODAL_EVENT, onUpgrade)
    return () => window.removeEventListener(UPGRADE_MODAL_EVENT, onUpgrade)
  }, [])

  const openUpgrade = useCallback((message) => {
    setUpgradeMessage(message || DEFAULT_UPGRADE)
    setUpgradeModalOpen(true)
    setLimitModalOpen(false)
  }, [])

  const value = useMemo(
    () => ({
      billingPlanData,
      /** @deprecated use billingPlanData — alias for backward compatibility */
      plan: billingPlanData,
      effectivePlan: String(
        billingPlanData?.plan || billingPlanData?.effectivePlan || 'free',
      ).toLowerCase(),
      planType: billingPlanData?.planType ?? 'free',
      trialActive: billingPlanData?.trialActive ?? false,
      trialEndsAt: billingPlanData?.trialEndsAt ?? null,
      subscriptionEndsAt: billingPlanData?.subscriptionEndsAt ?? null,
      cancelAtPeriodEnd: billingPlanData?.cancelAtPeriodEnd ?? false,
      features: billingPlanData?.features,
      limits: billingPlanData?.limits,
      documentsCreatedToday: billingPlanData?.documentsCreatedToday ?? null,
      loading,
      error,
      fetchPlan,
      refreshPlan,
      openUpgrade,
      /** @param {'export'|'purchase_orders'|'tax_purchase'} key */
      billingFeatureEnabled: (key) => {
        if (
          billingPlanData &&
          BILLING_GATED_FEATURE_KEYS.has(key) &&
          hasFullProFeatureAccess(billingPlanData)
        ) {
          return true
        }
        if (billingPlanData?.features && typeof billingPlanData.features[key] === 'boolean') {
          return billingPlanData.features[key] === true
        }
        return canUseFeature(key)
      },
    }),
    [billingPlanData, loading, error, fetchPlan, openUpgrade],
  )

  return (
    <BillingContext.Provider value={value}>
      {children}
      <UpgradeModal
        open={upgradeModalOpen}
        message={upgradeMessage}
        onClose={() => setUpgradeModalOpen(false)}
      />
      <LimitModal
        open={limitModalOpen}
        message={limitMessage}
        onClose={() => setLimitModalOpen(false)}
      />
    </BillingContext.Provider>
  )
}

export function useBilling() {
  const ctx = useContext(BillingContext)
  if (!ctx) {
    throw new Error('useBilling must be used within BillingProvider')
  }
  return ctx
}
