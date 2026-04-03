import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import LimitModal from '../components/LimitModal.jsx'
import UpgradeModal, { UPGRADE_MODAL_EVENT } from '../components/UpgradeModal.jsx'
import {
  clearBillingPlanCache,
  createDefaultFreePlanSnapshot,
  fetchBillingPlan,
  canUseFeature,
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [limitModalOpen, setLimitModalOpen] = useState(false)
  const [upgradeMessage, setUpgradeMessage] = useState(DEFAULT_UPGRADE)
  const [limitMessage, setLimitMessage] = useState(LIMIT_MSG)
  const location = useLocation()

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchBillingPlan({ force: true })
      const planData = res?.data ?? res ?? createDefaultFreePlanSnapshot()
      const tier = String(
        planData?.plan ?? planData?.effectivePlan ?? 'free',
      ).toLowerCase()
      const normalized = {
        ...planData,
        plan: tier,
        effectivePlan: tier,
      }
      console.log('FRONT PLAN:', normalized)
      setBillingPlanData(normalized)
      return normalized
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setBillingPlanData(createDefaultFreePlanSnapshot())
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
    fetchPlan().catch(() => {
      setBillingPlanData(createDefaultFreePlanSnapshot())
    })
  }, [location.pathname, fetchPlan])

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
