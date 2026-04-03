import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()

  const BASE = 30073
  const START = new Date('2026-01-01').getTime()

  const [users, setUsers] = useState(BASE)

  useEffect(() => {
    const now = Date.now()
    const hours = Math.floor((now - START) / (1000 * 60 * 60))
    setUsers(BASE + hours * 3)
  }, [])

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-white text-center">
      <h1 className="text-3xl font-bold text-slate-800">
        {users.toLocaleString()} คน กำลังใช้ QuickBill
      </h1>

      <p className="mt-2 text-gray-500">ระบบออกใบบิลของคนไทย</p>

      <button
        type="button"
        onClick={() => navigate('/login')}
        className="mt-6 rounded-lg bg-orange-500 px-6 py-3 text-white hover:bg-orange-600"
      >
        เริ่มใช้งานเลย 🚀
      </button>
    </div>
  )
}
