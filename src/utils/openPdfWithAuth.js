import { getStoredToken } from './authClient.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
if (!API_BASE_URL) {
  console.warn('VITE_API_URL is not set')
}

/**
 * GET PDF with Bearer token and open in a new tab.
 * Handles JSON error bodies and non-PDF responses without crashing the page.
 * @param {string} path Absolute or same-origin path, e.g. `/api/documents/${id}/pdf`
 */
export async function openPdfInNewTab(path) {
  const token = getStoredToken()
  if (!token) {
    alert('กรุณาเข้าสู่ระบบใหม่')
    return
  }
  const target =
    typeof path === 'string' && path.startsWith('/api/')
      ? `${API_BASE_URL || ''}${path}`
      : path

  try {
    const res = await fetch(target, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const ct = String(res.headers.get('content-type') || '')

    if (!res.ok) {
      let msg = 'โหลด PDF ไม่สำเร็จ'
      if (ct.includes('application/json')) {
        try {
          const j = await res.json()
          if (j && (j.error != null || j.message != null)) {
            msg = String(j.error ?? j.message)
          }
        } catch {
          /* ignore */
        }
      }
      alert(msg)
      return
    }

    if (ct.includes('application/json')) {
      try {
        const j = await res.json()
        const msg =
          j && (j.error != null || j.message != null)
            ? String(j.error ?? j.message)
            : 'โหลด PDF ไม่สำเร็จ'
        alert(msg)
      } catch {
        alert('โหลด PDF ไม่สำเร็จ')
      }
      return
    }

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)

    const isIOS =
      typeof navigator !== 'undefined' &&
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !window.MSStream

    if (isIOS) {
      // iOS Safari/Chrome: open in current tab to let the browser handle the PDF viewer.
      window.location.href = url
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = 'document.pdf'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }

    // Best-effort cleanup; some mobile browsers may ignore this.
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 1000)
  } catch (err) {
    console.error(err)
    alert('โหลด PDF ไม่สำเร็จ')
  }
}
