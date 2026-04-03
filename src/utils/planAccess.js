/** Keys gated in Navbar / BillingContext / export flows. */
export const BILLING_GATED_FEATURE_KEYS = new Set([
  'export',
  'purchase_orders',
  'tax_purchase',
])

/**
 * Trial + paid basic/pro (and business) = full PRO feature access in UI.
 * @param {{ effectivePlan?: string, planType?: string, trialActive?: boolean } | null | undefined} snapshot
 */
export function hasFullProFeatureAccess(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false
  const plan = String(snapshot.plan ?? snapshot.effectivePlan ?? snapshot.planType ?? 'free').toLowerCase()
  const isPaid = plan === 'pro' || plan === 'basic'
  const isTrial = plan === 'trial' || snapshot.trialActive === true
  return isPaid || isTrial || plan === 'business'
}

/** Same allow-list as server `allowsProBasicAndTrial` — only `free` blocked for these features. */
export function allowsProBasicAndTrial(plan) {
  const p = String(plan ?? 'free').toLowerCase()
  return p === 'pro' || p === 'basic' || p === 'trial' || p === 'business'
}

/**
 * Central plan → flags for limits and feature gates (mirror of server planAccess).
 * @param {string} [plan]
 */
export function getPlanAccess(plan) {
  const p = String(plan || 'free').toLowerCase()
  const featureOk = allowsProBasicAndTrial(p)

  return {
    isFree: p === 'free',
    isTrial: p === 'trial',
    isBasic: p === 'basic',
    isPro: p === 'pro',
    isBusiness: p === 'business',

    limitDocuments: p === 'free',

    canExport: featureOk,
    canUsePO: featureOk,
    canRemoveWatermark: featureOk,
    canUseAdvancedTax: featureOk,

    isUnlimited: ['trial', 'basic', 'pro', 'business'].includes(p),
  }
}
