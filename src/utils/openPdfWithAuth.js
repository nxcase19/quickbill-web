import { getStoredToken } from './authClient.js'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''
if (!API_BASE_URL) {
  console.warn('VITE_API_URL is not set')
}

async function fetchPdfBlob(target, token) {
  const res = await fetch(target, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
    throw new Error(msg)
  }

  if (ct.includes('application/json')) {
    try {
      const j = await res.json()
      const msg =
        j && (j.error != null || j.message != null)
          ? String(j.error ?? j.message)
          : 'โหลด PDF ไม่สำเร็จ'
      throw new Error(msg)
    } catch {
      throw new Error('โหลด PDF ไม่สำเร็จ')
    }
  }

  return await res.blob()
}

/**
 * Preview PDF by navigating to an object URL (good for desktop/mobile preview).
 * @param {string} path Absolute or same-origin path, e.g. `/api/documents/${id}/pdf`
 */
export async function previewPdf(path) {
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
    const blob = await fetchPdfBlob(target, token)
    const fileURL = window.URL.createObjectURL(blob)
    window.open(fileURL, '_blank')
    setTimeout(() => window.URL.revokeObjectURL(fileURL), 60_000)
  } catch (err) {
    console.error(err)
    alert(err?.message || 'โหลด PDF ไม่สำเร็จ')
  }
}

/**
 * Download PDF with Bearer token and trigger a file download.
 * @param {string} path Absolute or same-origin path, e.g. `/api/documents/${id}/pdf`
 */
export async function downloadPdf(path) {
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
    const blob = await fetchPdfBlob(target, token)
    const url = window.URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'document.pdf'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()

    setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 1000)
  } catch (err) {
    console.error(err)
    alert(err?.message || 'โหลด PDF ไม่สำเร็จ')
  }
}

/**
 * Share PDF via Web Share API (mobile-friendly).
 * Falls back to alert if not supported.
 * @param {string} path Absolute or same-origin path, e.g. `/api/documents/${id}/pdf`
 */
export async function sharePdf(path) {
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
    const blob = await fetchPdfBlob(target, token)
    const file = new File([blob], 'document.pdf', {
      type: 'application/pdf',
    })

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'QuickBill Document',
      })
    } else if (navigator.share && !navigator.canShare) {
      // Basic share without files (some browsers support this)
      await navigator.share({
        title: 'QuickBill Document',
        text: 'ดาวน์โหลดเอกสารจาก QuickBill',
      })
    } else {
      alert('ไม่รองรับการแชร์บนอุปกรณ์นี้')
    }
  } catch (err) {
    console.error(err)
    alert(err?.message || 'แชร์เอกสารไม่สำเร็จ')
  }
}

/**
 * Backwards-compatible helper name for existing callers.
 * Now behaves as "preview first" instead of auto-download.
 * @param {string} path
 */
export async function openPdfInNewTab(path) {
  await previewPdf(path)
}
