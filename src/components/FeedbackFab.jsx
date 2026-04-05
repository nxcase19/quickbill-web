import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../services/api.js'
import { getStoredToken } from '../utils/authClient.js'

export default function FeedbackFab() {
  const location = useLocation()
  const token = getStoredToken()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(t)
  }, [toast])

  if (!token) return null

  function resetAndClose() {
    setType('bug')
    setMessage('')
    setOpen(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const text = message.trim()
    if (!text || sending) return

    setSending(true)
    try {
      await api.post('/api/feedback', {
        type,
        message: text,
        page: location.pathname || window.location.pathname || '/',
      })
      setToast('ส่งข้อมูลเรียบร้อย ขอบคุณมาก 🙏')
      resetAndClose()
    } catch {
      setToast('ส่งไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {toast ? (
        <div
          className="fixed right-4 top-20 z-[200] max-w-[min(100vw-2rem,20rem)] rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-4 z-[100] flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 md:bottom-6 md:right-6"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="แจ้งปัญหาหรือเสนอฟีเจอร์"
      >
        <span aria-hidden>💬</span>
        <span>แจ้งปัญหา</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) resetAndClose()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-dialog-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2
              id="feedback-dialog-title"
              className="text-lg font-semibold text-slate-900"
            >
              แจ้งปัญหา / เสนอฟีเจอร์
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              หน้าปัจจุบัน: {location.pathname}
            </p>

            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <label className="block text-sm font-medium text-slate-700">
                ประเภท
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="bug">bug — แจ้งบั๊ก</option>
                  <option value="feature">feature — เสนอฟีเจอร์</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                ข้อความ <span className="text-red-600">*</span>
                <textarea
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={8000}
                  placeholder="อธิบายปัญหาหรือไอเดียของคุณ…"
                  className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </label>

              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? 'กำลังส่ง…' : 'ส่ง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
