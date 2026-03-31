export function getStoredToken() {
  const token = localStorage.getItem('token')
  if (!token || String(token).trim() === '') return null
  return String(token).trim()
}

export function buildAuthHeaders(extraHeaders = {}) {
  const token = getStoredToken()
  if (!token) return null
  return {
    ...extraHeaders,
    Authorization: `Bearer ${token}`,
  }
}

/** Clears session token (logout / forced 401). Billing cache cleared separately or via BillingContext when token missing. */
export function clearStoredAuth() {
  try {
    localStorage.removeItem('token')
  } catch {
    /* ignore */
  }
}
