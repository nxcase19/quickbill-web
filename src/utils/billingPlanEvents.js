/** Dispatched after /auth/login, /auth/register, /auth/google with `{ account }` or full account object. */
export const SET_PLAN_EVENT = 'SET_PLAN'

/**
 * Apply plan from login/register/google response (outside React tree).
 * @param {{ account?: object } | Record<string, unknown> | null | undefined} loginData
 */
export function setPlanFromLogin(loginData) {
  if (loginData == null || typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SET_PLAN_EVENT, { detail: loginData }))
}
