import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBilling } from '../context/BillingContext.jsx'
import { persistAccountFromAuth } from '../utils/planClient.js'

const PAID = new Set(['basic', 'pro', 'business'])
const API_BASE_URL = import.meta.env.VITE_API_URL || ''
const MIN_SUCCESS_MS = 3000
const CELEBRATE_KEY = 'quickbill_billing_celebrate'

if (!API_BASE_URL) {
  console.warn('VITE_API_URL is not set')
}

export default function BillingSuccess() {
  const navigate = useNavigate()
  const { refreshPlan } = useBilling()
  const [phase, setPhase] = useState('polling')
  const startedAt = useRef(Date.now())
  const finishedRef = useRef(false)

  useEffect(() => {
    let attempts = 0
    let intervalId = 0

    const finish = async () => {
      if (finishedRef.current) return
      finishedRef.current = true
      if (intervalId) clearInterval(intervalId)
      setPhase('finishing')
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

      const elapsed = Date.now() - startedAt.current
      const waitMore = Math.max(0, MIN_SUCCESS_MS - elapsed)
      if (waitMore > 0) {
        await new Promise((r) => setTimeout(r, waitMore))
      }

      try {
        sessionStorage.setItem(CELEBRATE_KEY, '1')
      } catch {
        /* ignore */
      }
      navigate('/dashboard', { replace: true })
    }

    const poll = async () => {
      if (finishedRef.current) return
      attempts += 1
      const t = localStorage.getItem('token')
      if (!t) {
        if (attempts >= 12) await finish()
        return
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/billing/plan?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${t}`, 'Cache-Control': 'no-store' },
          cache: 'no-store',
        })
        const body = await res.json().catch(() => ({}))
        const data = body?.data ?? body
        const eff = String(data?.plan ?? data?.effectivePlan ?? '').toLowerCase()
        if (PAID.has(eff)) {
          await finish()
          return
        }
        if (attempts >= 12) {
          await finish()
        }
      } catch (e) {
        console.error(e)
        if (attempts >= 12) await finish()
      }
    }

    void poll()
    intervalId = window.setInterval(() => void poll(), 1000)

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [refreshPlan, navigate])

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 py-12 text-center">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">🎉 ชำระเงินสำเร็จ!</h1>
      <p className="mt-4 max-w-md text-base text-slate-600">
        ระบบกำลังอัปเกรดแพ็กเกจของคุณ…
      </p>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        {phase === 'finishing'
          ? 'กำลังพาคุณกลับไป Dashboard…'
          : 'กรุณารอสักครู่ เรากำลังยืนยันกับ Stripe'}
      </p>
    </div>
  )
}
