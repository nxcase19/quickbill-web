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
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-10 text-center">
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-3xl font-bold tracking-tight text-slate-800 sm:text-4xl">
          {users.toLocaleString()} คน กำลังใช้ QuickBill
        </h1>

        <p className="mt-2 text-sm text-gray-400">
          มีการออกเอกสารแล้วกว่า 1,200,000 ใบ
        </p>

        <p className="mt-3 text-base text-gray-600">ระบบออกบิลของคนไทย</p>

        <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm text-gray-500">
          <span>🇹🇭 รองรับ VAT 7%</span>
          <span>📄 ออกเอกสารครบ (INV / QT / RC)</span>
          <span>🔒 ข้อมูลปลอดภัย</span>
        </div>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-8 w-full max-w-xs rounded-xl bg-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-orange-600 sm:w-auto"
        >
          เริ่มใช้งานฟรี 🚀
        </button>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-3 text-sm text-gray-500 underline decoration-gray-400 underline-offset-2 transition hover:text-gray-700"
        >
          เข้าสู่ระบบ
        </button>

        <p className="mt-2 text-xs text-gray-400">
          ทดลองใช้งานฟรี 7 วัน • ไม่ต้องใช้บัตรเครดิต
        </p>
      </div>
    </div>
  )
}
