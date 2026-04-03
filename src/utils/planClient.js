import api from '../services/api.js'
import {
  BILLING_GATED_FEATURE_KEYS,
  getPlanAccess,
  hasFullProFeatureAccess,
} from './planAccess.js'

const LS_BILLING_PLAN = 'quickbill_billing_plan_v1'
const LS_ACCOUNT = 'quickbill_account_v1'

let cache = null
let inflight = null

/** Mirrors backend usageService / product copy (UI only until API exposes live counters). */
export const FREE_DOCS_PER_DAY = 3
export const FREE_DOCS_PER_MONTH = 50

/**
 * Feature matrix by *effective* plan tier (same rules as server planAccess).
 * @param {string} effective
 */
export function featuresForEffectivePlan(effective) {
  const a = getPlanAccess(effective)
  return {
    export: a.canExport,
    purchase_orders: a.canUsePO,
    tax_purchase: a.canUseAdvancedTax,
  }
}

/**
 * Build plan snapshot from login `account` object (before /billing/plan loads).
 * @param {Record<string, unknown> | null | undefined} account
 */
export function planShapeFromAccount(account) {
  if (!account || typeof account !== 'object') return null
  const planType = String(account.plan_type ?? account.planType ?? 'free').toLowerCase()
  const trialEnd = account.trial_ends_at
    ? new Date(String(account.trial_ends_at)).getTime()
    : 0
  const trialStart = account.trial_started_at
    ? new Date(String(account.trial_started_at)).getTime()
    : 0
  const now = Date.now()
  const trialActive = !!(trialStart && trialEnd && now >= trialStart && now < trialEnd)
  const effectivePlan = trialActive ? 'trial' : planType
  return {
    plan: effectivePlan,
    planType,
    effectivePlan,
    trialActive,
    features: featuresForEffectivePlan(effectivePlan),
    limits: {
      freeDocumentsPerDay: FREE_DOCS_PER_DAY,
      freeDocumentsPerMonth: FREE_DOCS_PER_MONTH,
    },
  }
}

export function persistAccountFromAuth(account) {
  if (!account || typeof account !== 'object') return
  try {
    localStorage.setItem(LS_ACCOUNT, JSON.stringify(account))
  } catch {
    /* ignore */
  }
}

function readPersistedAccount() {
  try {
    const raw = localStorage.getItem(LS_ACCOUNT)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** For UI (e.g. trial countdown) — same source as login persistence. */
export function getPersistedAccount() {
  return readPersistedAccount()
}

/**
 * Plan label from `quickbill_account_v1` only — no billing API.
 * Trial window → `trial`; else `plan` / `plan_type` / `free`.
 * @returns {{ plan: string }}
 */
export function getCurrentPlanSafe() {
  if (typeof window === 'undefined') {
    return { plan: 'free' }
  }
  const raw = localStorage.getItem(LS_ACCOUNT)
  if (!raw) return { plan: 'free' }
  try {
    const parsed = JSON.parse(raw)
    const start = parsed?.trial_started_at
    const end = parsed?.trial_ends_at
    const now = Date.now()
    const t0 = start ? new Date(String(start)).getTime() : 0
    const t1 = end ? new Date(String(end)).getTime() : 0
    const trialActive =
      Number.isFinite(t0) &&
      Number.isFinite(t1) &&
      t0 > 0 &&
      t1 > 0 &&
      now >= t0 &&
      now < t1
    if (trialActive) return { plan: 'trial' }
    const p = parsed?.plan ?? parsed?.plan_type ?? 'free'
    return { plan: String(p || 'free').toLowerCase() }
  } catch {
    return { plan: 'free' }
  }
}

function withSyncedLimits(p) {
  if (!p || typeof p !== 'object') return p
  return {
    ...p,
    limits: {
      ...(typeof p.limits === 'object' && p.limits ? p.limits : {}),
      freeDocumentsPerDay: FREE_DOCS_PER_DAY,
      freeDocumentsPerMonth: FREE_DOCS_PER_MONTH,
    },
  }
}

/**
 * Normalize GET /api/billing/plan (axios response or raw body).
 * @param {unknown} res
 * @returns {ReturnType<typeof createDefaultFreePlanSnapshot> | null}
 */
export function normalizeBillingPlanResponse(res) {
  const outer = res?.data ?? res ?? {}
  const raw =
    outer &&
    typeof outer === 'object' &&
    outer.success === true &&
    outer.data != null &&
    typeof outer.data === 'object'
      ? outer.data
      : outer
  if (!raw || typeof raw !== 'object') return null
  return withSyncedLimits({
    plan: String(raw.plan ?? raw.effectivePlan ?? 'free').toLowerCase(),
    effectivePlan: String(raw.effectivePlan ?? raw.plan ?? 'free').toLowerCase(),
    planType: String(raw.planType ?? 'free').toLowerCase(),
    trialActive: raw.trialActive === true,
    trialEndsAt: raw.trialEndsAt ?? null,
    subscriptionEndsAt: raw.subscriptionEndsAt ?? null,
    cancelAtPeriodEnd: raw.cancelAtPeriodEnd === true,
    features: raw.features && typeof raw.features === 'object' ? raw.features : {},
    limits:
      raw.limits && typeof raw.limits === 'object'
        ? { ...raw.limits }
        : {
            freeDocumentsPerDay: FREE_DOCS_PER_DAY,
            freeDocumentsPerMonth: FREE_DOCS_PER_MONTH,
          },
    documentsCreatedToday: raw.documentsCreatedToday ?? null,
  })
}

function readPersistedBillingPlan() {
  try {
    const raw = localStorage.getItem(LS_BILLING_PLAN)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function persistBillingPlanToStorage(plan) {
  if (!plan || typeof plan !== 'object') return
  try {
    localStorage.setItem(LS_BILLING_PLAN, JSON.stringify(plan))
  } catch {
    /* ignore */
  }
}

/** Clears in-memory + persisted billing snapshot only (keeps quickbill_account_v1). */
export function clearBillingPlanApiCache() {
  cache = null
  inflight = null
  try {
    localStorage.removeItem(LS_BILLING_PLAN)
  } catch {
    /* ignore */
  }
}

export function clearBillingPlanCache() {
  cache = null
  inflight = null
  try {
    localStorage.removeItem(LS_ACCOUNT)
    localStorage.removeItem(LS_BILLING_PLAN)
  } catch {
    /* ignore */
  }
}

/** Fallback snapshot when logged in but billing cache/API has not hydrated yet. */
export function createDefaultFreePlanSnapshot() {
  return {
    plan: 'free',
    planType: 'free',
    effectivePlan: 'free',
    trialActive: false,
    trialEndsAt: null,
    subscriptionEndsAt: null,
    cancelAtPeriodEnd: false,
    features: featuresForEffectivePlan('free'),
    limits: {
      freeDocumentsPerDay: FREE_DOCS_PER_DAY,
      freeDocumentsPerMonth: FREE_DOCS_PER_MONTH,
    },
    documentsCreatedToday: null,
  }
}

/**
 * Current plan snapshot: memory cache → persisted billing → account-only fallback.
 * @returns {{
 *   planType: string,
 *   effectivePlan: string,
 *   trialActive: boolean,
 *   features: { export: boolean, purchase_orders: boolean, tax_purchase: boolean },
 *   limits: { freeDocumentsPerDay: number, freeDocumentsPerMonth: number }
 * } | null}
 */
export function getCurrentPlan() {
  if (cache) return withSyncedLimits(cache)
  const persisted = readPersistedBillingPlan()
  if (persisted) return withSyncedLimits(persisted)
  const fromAccount = planShapeFromAccount(readPersistedAccount())
  if (fromAccount) return withSyncedLimits(fromAccount)
  return null
}

const billingPlanRequestConfig = () => ({
  params: { _t: Date.now() },
  headers: {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  },
})

/**
 * @param {{ force?: boolean }} [options] force=true ข้าม memory cache และยิง API ใหม่เสมอ
 * @returns {Promise<import('./planClient.js').getCurrentPlan extends () => infer R ? R : never>}
 */
export async function fetchBillingPlan(options = {}) {
  const force = options.force === true
  const token = localStorage.getItem('token')
  if (!token) {
    clearBillingPlanCache()
    return null
  }

  const applyResponse = (res) => {
    const next = normalizeBillingPlanResponse(res)
    if (!next) return null
    cache = next
    persistBillingPlanToStorage(next)
    return next
  }

  if (force) {
    return api
      .get('/api/billing/plan', billingPlanRequestConfig())
      .then((res) => applyResponse(res))
      .catch(() => null)
  }

  if (cache) return withSyncedLimits(cache)
  if (inflight) return inflight

  inflight = api
    .get('/api/billing/plan', billingPlanRequestConfig())
    .then((res) => applyResponse(res))
    .catch(() => null)
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function getCachedBillingPlan() {
  return cache
}

/** Sync in-memory cache (e.g. after fetch) — also persists. */
export function setBillingPlanCache(plan) {
  cache = plan
  if (plan) persistBillingPlanToStorage(plan)
}

/**
 * @param {'export'|'purchase_orders'|'tax_purchase'} feature
 */
export function canUseFeature(feature) {
  const p = getCurrentPlan()
  if (p && BILLING_GATED_FEATURE_KEYS.has(feature) && hasFullProFeatureAccess(p)) {
    return true
  }
  if (p?.features && typeof p.features[feature] === 'boolean') {
    return p.features[feature] === true
  }
  const eff = p?.plan ?? p?.effectivePlan ?? p?.planType ?? 'free'
  return featuresForEffectivePlan(eff)[feature] === true
}

/** Effective access tier from GET /api/billing/plan — prefer `plan` / `effectivePlan`, not stored `planType`. */
export function billingEffectiveTierFromSnapshot(p) {
  if (!p || typeof p !== 'object') return 'free'
  const t = p.plan ?? p.effectivePlan ?? p.planType ?? 'free'
  return String(t || 'free').toLowerCase()
}

export function isFreePlan() {
  const p = getCurrentPlan()
  if (!p) return true
  return billingEffectiveTierFromSnapshot(p) === 'free'
}

export function isBasicPlan() {
  const p = getCurrentPlan()
  if (!p || p.trialActive) return false
  return billingEffectiveTierFromSnapshot(p) === 'basic'
}

export function isProPlan() {
  const p = getCurrentPlan()
  if (!p) return false
  const e = billingEffectiveTierFromSnapshot(p)
  if (e === 'trial') return true
  if (p.trialActive) return true
  return e === 'pro' || e === 'business'
}

export function isBusinessPlan() {
  const p = getCurrentPlan()
  if (!p || p.trialActive) return false
  return billingEffectiveTierFromSnapshot(p) === 'business'
}

/**
 * Navbar / pricing CTA: show when user is not on Pro/Business (trial users = full access → hidden).
 * @param {ReturnType<typeof getCurrentPlan>} [planSnapshot] pass React context `plan` when available
 */
export function showPricingUpgradeCta(planSnapshot) {
  const p = planSnapshot ?? getCurrentPlan()
  if (!p) return true
  return !hasFullProFeatureAccess(p)
}

/** @param {'export'|'purchase_orders'|'tax_purchase'} key */
export function billingFeatureEnabled(key) {
  return canUseFeature(key)
}
