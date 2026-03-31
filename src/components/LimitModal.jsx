import { useNavigate } from 'react-router-dom'

const DEFAULT_MSG = 'คุณใช้ครบแล้วในวันนี้'

export default function LimitModal({ open, message, onClose }) {
  const navigate = useNavigate()

  if (!open) return null

  function goPricing() {
    onClose()
    navigate('/pricing')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="limit-modal-title"
      >
        <h2 id="limit-modal-title" className="text-lg font-semibold text-slate-900">
          ถึงขีดจำกัดการใช้งาน
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {message || DEFAULT_MSG}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-row-reverse">
          <button
            type="button"
            className="min-h-11 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 sm:flex-1"
            onClick={goPricing}
          >
            อัปเกรดแพ็กเกจ
          </button>
          <button
            type="button"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-1"
            onClick={onClose}
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
