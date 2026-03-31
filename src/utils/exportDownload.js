/**
 * Parse filename from Content-Disposition (attachment; filename="..." or filename*=...)
 */
export function filenameFromContentDisposition(header) {
  if (!header || typeof header !== 'string') return null

  const star = /filename\*=(?:UTF-8''|)([^;\n]+)/i.exec(header)
  if (star) {
    let raw = star[1].trim().replace(/^["']|["']$/g, '')
    try {
      return decodeURIComponent(raw) || null
    } catch {
      return raw || null
    }
  }

  const quoted = /filename=(?:"([^"]*)"|([^;\s]+))/i.exec(header)
  if (quoted) {
    const name = (quoted[1] ?? quoted[2] ?? '').trim()
    return name || null
  }
  return null
}

export function downloadBlobFromApiResponse(res) {
  const blob = new Blob([res.data])

  // 🔥 รองรับทั้ง axios และ fetch
  const disposition =
    res.headers?.['content-disposition'] ||
    res.headers?.get?.('content-disposition')

  let filename = 'download.xlsx'

  if (disposition) {
    // รองรับทั้ง filename="..." และ filename=...
    const match =
      disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)

    if (match && match[1]) {
      filename = decodeURIComponent(match[1].replace(/"/g, ''))
    }
  }

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename

  document.body.appendChild(a)
  a.click()

  a.remove()
  window.URL.revokeObjectURL(url)
}
