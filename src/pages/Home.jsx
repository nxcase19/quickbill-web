import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh flex-col gap-8 py-8 md:py-10">
      <h1 className="text-center text-2xl font-semibold text-slate-800 sm:text-3xl">
        Welcome to QuickBill
      </h1>
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate('/create')}
          className="w-full rounded-xl border border-slate-200 bg-white px-6 py-4 text-lg font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          ออกเอกสารใหม่
        </button>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="w-full rounded-xl border border-slate-200 bg-white px-6 py-4 text-lg font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          สินค้า / บริการ
        </button>
        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 bg-white px-6 py-4 text-lg font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          บิลค้างชำระ
        </button>
        <button
          type="button"
          onClick={() => navigate('/history')}
          className="w-full rounded-xl border border-slate-200 bg-white px-6 py-4 text-lg font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          บิลทั้งหมด
        </button>
        <button
          type="button"
          onClick={() => navigate('/customers')}
          className="w-full rounded-xl border border-slate-200 bg-white px-6 py-4 text-lg font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          ลูกค้าประจำ
        </button>
      </div>
    </div>
  )
}
