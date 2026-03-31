import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api.js'
import { getStoredToken } from '../utils/authClient.js'
import { clearBillingPlanCache, persistAccountFromAuth } from '../utils/planClient.js'

export default function Login() {
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
      const { data } = await api.post('/api/auth/login', { email, password })
      const token = data?.token
      if (token) {
        clearBillingPlanCache()
        persistAccountFromAuth(data?.account)
        localStorage.setItem('token', token)
        navigate('/dashboard', { replace: true })
      } else {
        setError('Invalid response from server')
      }
    } catch (err) {
      setError(
        err?.response?.data?.error || err?.message || 'เข้าสู่ระบบไม่สำเร็จ',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 py-8">
      <h1 className="text-center text-2xl font-semibold text-slate-800 sm:text-3xl">
        QuickBill
      </h1>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="login-email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            อีเมล
          </label>
          <input
            id="login-email"
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
            htmlFor="login-password"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            รหัสผ่าน
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-800 focus:border-slate-400 focus:outline-none"
          />
        </div>

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
          {loading ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-600">
        ยังไม่มีบัญชี?{' '}
        <Link to="/register" className="font-medium text-slate-900 underline">
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  )
}
