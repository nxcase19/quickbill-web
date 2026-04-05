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

  const features = [
    'สรุปรายรับ–รายจ่ายทันที',
    'คำนวณภาษีให้อัตโนมัติ',
    'ใช้งานง่าย ไม่ต้องมีพื้นฐานบัญชี',
    'ใช้ได้ทั้งมือถือและคอม',
  ]

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

        <ul className="mx-auto mt-6 flex w-full max-w-[min(100%,320px)] list-none flex-col gap-2.5 p-0 text-center text-[15px] leading-snug text-[#374151] sm:max-w-[320px]">
          {features.map((line) => (
            <li
              key={line}
              className="flex items-center justify-center gap-2 text-center"
            >
              <span
                className="inline-flex size-4 shrink-0 items-center justify-center text-[16px] leading-none text-[#16a34a]"
                aria-hidden
              >
                ✔
              </span>
              <span className="min-w-0 text-pretty">{line}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex w-full flex-col items-center text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full max-w-xs rounded-xl bg-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-orange-600 sm:w-auto"
          >
            เริ่มใช้งานฟรี 🚀
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-3 block w-full text-center text-sm text-gray-500 underline decoration-gray-400 underline-offset-2 transition hover:text-gray-700"
          >
            เข้าสู่ระบบ
          </button>

          <p className="mt-1.5 text-xs text-[#6B7280]">
            ทดลองใช้งานฟรี 7 วัน
          </p>
        </div>
      </div>
    </div>
  )
}
