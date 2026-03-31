import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../services/api.js'
import { getStoredToken } from '../utils/authClient.js'

/**
 * Soft prompt when company_settings has no display name yet.
 * Does not block any feature (documents/PDF work with empty header).
 */
export default function OnboardingBanner() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const p = location.pathname
    if (p === '/login' || p === '/register') {
      setVisible(false)
      return
    }
    const token = getStoredToken()
    if (!token) {
      setVisible(false)
      return
    }
    let cancelled = false
    api
      .get('/api/company')
      .then((res) => {
        if (cancelled) return
        const c = res?.data
        const name = c?.company_name != null ? String(c.company_name).trim() : ''
        setVisible(name === '')
      })
      .catch(() => {
        if (!cancelled) setVisible(false)
      })
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (!visible) return null

  return (
    <div className="pt-4">
      <div
        className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 shadow-sm"
        role="status"
      >
        <p className="font-medium">ตั้งค่าบริษัท (ไม่บังคับ)</p>
        <p className="mt-1 text-sky-900/90">
          คุณยังไม่ได้กรอกชื่อบริษัท — ใช้งานออกบิลและเอกสารได้ตามปกติ
          ตั้งค่าได้ภายหลังเมื่อสะดวก
        </p>
        <Link
          to="/company-settings"
          className="mt-2 inline-block font-medium text-sky-950 underline decoration-sky-600 underline-offset-2"
        >
          ไปหน้าตั้งค่าบริษัท
        </Link>
      </div>
    </div>
  )
}
