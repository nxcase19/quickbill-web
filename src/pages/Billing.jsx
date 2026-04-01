import { useCallback, useEffect, useState } from 'react'
import { getStoredToken } from '../utils/authClient.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
if (!API_BASE_URL) {
  console.warn('VITE_API_URL is not set')
}

const PAID = new Set(['basic', 'pro', 'business'])

function tierLabel(planType) {
  const p = String(planType ?? '').toLowerCase()
  if (p === 'basic') return 'BASIC'
  if (p === 'pro') return 'PRO'
  if (p === 'business') return 'BUSINESS'
  return 'FREE'
}

function isPaidStoredPlan(planType) {
  return PAID.has(String(planType ?? '').toLowerCase())
}

/** แมป response จาก GET /api/billing/plan (axios คืน payload.data แล้ว) */
function mapBillingPlanPayload(d) {
  if (!d || typeof d !== 'object') return null
  return {
    planType: d.planType,
    subscriptionEndsAt: d.subscriptionEndsAt ?? null,
    trialActive: d.trialActive === true,
    cancelAtPeriodEnd: d.cancelAtPeriodEnd === true,
  }
}

export default function Billing() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const token = getStoredToken()
      if (!token) {
        throw new Error('Missing auth token')
      }

      console.log('TOKEN:', token)

      const res = await fetch(`${API_BASE_URL}/api/billing/plan`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-store',
        },
        credentials: 'include',
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed (${res.status})`)
      }

      const body = await res.json().catch(() => null)
      const payload =
        body && typeof body === 'object' && body.data && typeof body.data === 'object'
          ? body.data
          : body
      const mapped = mapBillingPlanPayload(payload)
      setData(mapped)
    } catch (err) {
      console.error('BILLING ERROR:', err)
      setLoadError(err?.message || 'โหลดข้อมูลไม่สำเร็จ')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCancel = async () => {
    if (!confirm('ยืนยันยกเลิกแพ็กเกจ?')) return

    try {
      const token = getStoredToken()
      if (!token) {
        throw new Error('Missing auth token')
      }

      console.log('TOKEN:', token)

      const res = await fetch(`${API_BASE_URL}/api/billing/cancel-subscription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Request failed (${res.status})`)
      }

      setLoading(true)
      await fetchPlan()
    } catch (err) {
      console.error('BILLING ERROR:', err)
      alert(err?.message || 'ยกเลิกไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  if (loading) return <div className="p-6">Loading...</div>

  if (loadError || !data) {
    return (
      <div className="max-w-2xl mx-auto mt-10 bg-white p-6 rounded-xl shadow-sm">
        <h1 className="text-2xl font-semibold mb-6">Billing</h1>
        <p className="text-slate-600">{loadError || 'ไม่มีข้อมูล'}</p>
      </div>
    )
  }

  const storedTier = tierLabel(data.planType)
  const paid = isPaidStoredPlan(data.planType)

  return (
    <div className="max-w-2xl mx-auto mt-10 bg-white p-6 rounded-xl shadow-sm">
      <h1 className="text-2xl font-semibold mb-6">Billing</h1>

      <div className="space-y-3">
        <p>
          <strong>แพ็กเกจ:</strong> {storedTier}
        </p>

        <p className="text-sm text-slate-700">
          <strong>ทดลองใช้งาน:</strong> {data.trialActive ? 'ใช่' : 'ไม่'}
        </p>

        <p>
          <strong>หมดอายุการสมัคร:</strong>{' '}
          {data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt).toLocaleString() : '—'}
        </p>

        {data.cancelAtPeriodEnd ? (
          <p className="text-red-600 font-medium">แพ็กเกจจะถูกยกเลิกเมื่อสิ้นสุดรอบบิล</p>
        ) : null}
      </div>

      <div className="mt-6">
        {!paid && (
          <button
            type="button"
            onClick={() => {
              window.location.href = '/pricing'
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg"
          >
            Upgrade / ดูแพ็กเกจ
          </button>
        )}

        {paid && !data.cancelAtPeriodEnd ? (
          <button type="button" onClick={handleCancel} className="bg-red-600 text-white px-4 py-2 rounded-lg">
            ยกเลิกแพ็กเกจ
          </button>
        ) : null}
      </div>
    </div>
  )
}
