import axios from 'axios'
import { clearStoredAuth, getStoredToken } from '../utils/authClient.js'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  const url = String(config?.url || '')
  const isAuthRoute = url.startsWith('/api/auth/')

  if (!config.headers) {
    config.headers = {}
  }

  if (!token && !isAuthRoute) {
    const err = new Error('Missing token')
    err.code = 'AUTH_REQUIRED'
    throw err
  }

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const responseType = response?.config?.responseType
    if (responseType === 'blob' || responseType === 'arraybuffer') {
      return response
    }

    const payload = response?.data
    if (payload && typeof payload === 'object' && 'success' in payload) {
      if (!payload.success) {
        const code = payload.error
        if (
          typeof window !== 'undefined' &&
          (code === 'LIMIT_REACHED' || code === 'UPGRADE_REQUIRED')
        ) {
          window.dispatchEvent(
            new CustomEvent('quickbill:upgrade-modal', {
              detail: { reason: code, message: payload.message },
            }),
          )
        }
        const err = new Error(payload.message || payload.error || 'Request failed')
        err.code = code
        err.response = response
        throw err
      }
      response.data = payload.data
    }
    return response
  },
  async (error) => {
    const res = error.response
    const reqUrl = String(error.config?.url || '')

    if (res?.status === 401) {
      const isAuthAttempt =
        reqUrl.includes('/api/auth/login') ||
        reqUrl.includes('/api/auth/register') ||
        reqUrl.includes('/api/auth/google')
      if (!isAuthAttempt) {
        clearStoredAuth()
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/register')
        ) {
          window.location.assign('/login')
        }
      }
    }

    if (res?.data instanceof Blob) {
      const ct = String(res.headers['content-type'] || '')
      if (ct.includes('application/json')) {
        try {
          const text = await res.data.text()
          const j = JSON.parse(text)
          if (j.error === 'LIMIT_REACHED' || j.error === 'UPGRADE_REQUIRED') {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('quickbill:upgrade-modal', {
                  detail: { reason: j.error, message: j.message },
                }),
              )
            }
          }
          res.data = j
        } catch {
          /* ignore */
        }
      }
    }
    return Promise.reject(error)
  },
)

export default api
