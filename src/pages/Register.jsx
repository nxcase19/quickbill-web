import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api.js'
import { getStoredToken } from '../utils/authClient.js'
import { setPlanFromLogin } from '../utils/billingPlanEvents.js'
import { clearBillingPlanCache, persistAccountFromAuth } from '../utils/planClient.js'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (getStoredToken()) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/api/auth/register', {
        email,
        password,
      })
      const token = data?.token
      if (token) {
        clearBillingPlanCache()
        persistAccountFromAuth(data?.account)
        setPlanFromLogin({ account: data?.account })
        localStorage.setItem('token', token)
        navigate('/dashboard', { replace: true })
      } else {
        setError('Invalid response from server')
      }
    } catch (err) {
      setError(
        err?.response?.data?.error || err?.message || 'สมัครสมาชิกไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 py-8">
      <h1 className="text-center text-2xl font-semibold text-slate-800 sm:text-3xl">
        สมัครสมาชิก
      </h1>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="reg-email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            อีเมล
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-800 focus:border-slate-400 focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="reg-password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            รหัสผ่าน
          </label>
          <input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-800 focus:border-slate-400 focus:outline-none"
          />
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          ระบบจะสร้างบัญชีและทดลองใช้ 7 วันให้อัตโนมัติ
          ตั้งค่าชื่อบริษัทและที่อยู่ได้ภายหลังจากเมนูตั้งค่า
        </p>

        {error ? (
          <p className="text-center text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-6 py-4 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? 'กำลังสมัคร…' : 'สมัครสมาชิก'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        มีบัญชีแล้ว?{' '}
        <Link to="/login" className="font-medium text-slate-900 underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  )
}
