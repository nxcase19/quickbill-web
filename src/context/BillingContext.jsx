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

const BillingContext = createContext(null)

const DEFAULT_UPGRADE = 'ฟีเจอร์นี้ใช้ได้เฉพาะแพ็กเกจ Pro'
const LIMIT_MSG = 'คุณใช้ครบแล้วในวันนี้'

export function BillingProvider({ children }) {
  const [billingPlanData, setBillingPlanData] = useState(null)
  const [billingStatus, setBillingStatus] = useState('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [limitModalOpen, setLimitModalOpen] = useState(false)
  const [upgradeMessage, setUpgradeMessage] = useState(DEFAULT_UPGRADE)
  const [limitMessage, setLimitMessage] = useState(LIMIT_MSG)

  const resetBillingForLogout = useCallback(() => {
    clearBillingPlanCache()
    setBillingPlanData(null)
    setBillingStatus('idle')
    setError(null)
    setLoading(false)
  }, [])

  const fetchPlan = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      resetBillingForLogout()
      return null
    }

    if (import.meta.env.VITE_DISABLE_BILLING_FETCH === 'true') {
      setLoading(true)
      setError(null)
      try {
        const shaped = planShapeFromAccount(getPersistedAccount())
        let next
        if (shaped) {
          const t = String(shaped.plan ?? shaped.effectivePlan ?? 'free').toLowerCase()
          next = {
            ...shaped,
            plan: t,
            effectivePlan: t,
            planType: String(shaped.planType ?? t).toLowerCase(),
            trialEndsAt: null,
            subscriptionEndsAt: null,
            cancelAtPeriodEnd: false,
            documentsCreatedToday: null,
          }
        } else {
          next = createDefaultFreePlanSnapshot()
        }
        setBillingPlanData(next)
        setBillingStatus('ready')
        return next
      } finally {
        setLoading(false)
      }
    }

    setBillingStatus('loading')
    setLoading(true)
    setError(null)
    try {
      const normalized = await fetchBillingPlan({ force: true })
      if (normalized == null) {
        console.warn('PLAN FETCH FAILED: billing API returned null')
        setError('Billing plan unavailable')
        setBillingStatus('error')
        return null
      }
      setBillingPlanData(normalized)
      setBillingStatus('ready')
      return normalized
    } catch (e) {
      console.warn('PLAN FETCH FAILED:', e)
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setBillingStatus('error')
      return null
    } finally {
      setLoading(false)
    }
  }, [resetBillingForLogout])

  const refreshPlan = fetchPlan

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      clearBillingPlanCache()
      setBillingPlanData(null)
      setBillingStatus('idle')
      setError(null)
      setLoading(false)
      return
    }
    void fetchPlan()
    // Intentionally once on mount: billing is refreshed via refreshPlan (login, checkout, manual).
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const effectivePlanStr = billingPlanData
    ? String(billingPlanData.plan || billingPlanData.effectivePlan || 'free').toLowerCase()
    : ''

  const value = useMemo(
    () => ({
      billingPlanData,
      billingStatus,
      /** @deprecated use billingPlanData — alias for backward compatibility */
      plan: billingPlanData,
      effectivePlan: effectivePlanStr,
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
      resetBillingForLogout,
      openUpgrade,
      /** @param {'export'|'purchase_orders'|'tax_purchase'} key */
      billingFeatureEnabled: (key) => {
        if (!billingPlanData) {
          return canUseFeature(key)
        }
        if (
          BILLING_GATED_FEATURE_KEYS.has(key) &&
          hasFullProFeatureAccess(billingPlanData)
        ) {
          return true
        }
        if (billingPlanData.features && typeof billingPlanData.features[key] === 'boolean') {
          return billingPlanData.features[key] === true
        }
        return canUseFeature(key)
      },
    }),
    [
      billingPlanData,
      billingStatus,
      effectivePlanStr,
      loading,
      error,
      fetchPlan,
      openUpgrade,
    ],
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
