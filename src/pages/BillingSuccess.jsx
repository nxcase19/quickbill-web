import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBilling } from '../context/BillingContext.jsx'
import { persistAccountFromAuth } from '../utils/planClient.js'

const PAID = new Set(['basic', 'pro', 'business'])
const API_BASE_URL = import.meta.env.VITE_API_URL || ''
if (!API_BASE_URL) {
  console.warn('VITE_API_URL is not set')
}

export default function BillingSuccess() {
  const navigate = useNavigate()
  const { refreshPlan } = useBilling()

  useEffect(() => {
    let attempts = 0
    let finished = false
    let intervalId = 0

    const finish = async () => {
      if (finished) return
      finished = true
      if (intervalId) clearInterval(intervalId)
      try {
        await refreshPlan()
        const t = localStorage.getItem('token')
        if (t) {
          const meRes = await fetch(`${API_BASE_URL}/api/auth/me?_t=${Date.now()}`, {
            headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-store' },
            cache: 'no-store',
          })
          const me = await meRes.json().catch(() => ({}))
          if (me?.success && me?.data) {
            persistAccountFromAuth(me.data)
          }
        }
      } catch (e) {
        console.error(e)
      }
      navigate('/dashboard', { replace: true })
    }

    const poll = async () => {
      if (finished) return
      attempts += 1
      const t = localStorage.getItem('token')
      if (!t) {
        if (attempts >= 10) await finish()
        return
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/billing/plan?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-store' },
          cache: 'no-store',
        })
        const body = await res.json().catch(() => ({}))
        const data = body?.data ?? body
        const eff = String(data?.effectivePlan || '').toLowerCase()
        if (PAID.has(eff)) {
          await finish()
          return
        }
        if (attempts >= 10) {
          await finish()
        }
      } catch (e) {
        console.error(e)
        if (attempts >= 10) await finish()
      }
    }

    void poll()
    intervalId = window.setInterval(() => void poll(), 1000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [refreshPlan, navigate])

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <h1 className="text-xl font-semibold text-slate-900">กำลังยืนยันการชำระเงิน...</h1>
      <p className="mt-2 text-sm text-slate-600">กรุณารอสักครู่</p>
    </div>
  )
}
