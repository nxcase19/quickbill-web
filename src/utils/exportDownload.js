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

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function downloadBlobFromApiResponse(res) {
  const blob = new Blob([res.data], { type: XLSX_MIME })

  console.log(res.headers)

  const disposition =
    res.headers?.['content-disposition'] ??
    res.headers?.get?.('content-disposition')

  console.log('DISPOSITION:', disposition)

  let filename = 'export.xlsx'

  if (disposition && disposition.includes('filename=')) {
    const rest = disposition.split('filename=')[1]
    if (rest) {
      filename = rest.replace(/"/g, '').split(';')[0].trim() || filename
    }
  }

  const objectUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename

  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(objectUrl)
}
