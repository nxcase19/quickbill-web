const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

function parseToDate(date) {
  if (date == null || date === '') return null
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof date === 'number') {
    const d = new Date(date)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(date).trim()
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const day = Number(m[3])
    const d = new Date(y, mo - 1, day)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function localYMD(d) {
  return {
    y: d.getFullYear(),
    m: d.getMonth() + 1,
    day: d.getDate(),
  }
}

/**
 * @param {Date|string|number|null|undefined} date
 * @param {'th'|'en'|string} [language='th']
 * @param {'thai'|'iso'|'business'|string} [format='thai']
 * @returns {string}
 */
export function formatDate(date, language = 'th', format = 'thai') {
  const d = parseToDate(date)
  if (!d) return ''

  const fmt = String(format || 'thai').toLowerCase()
  const lang = language === 'en' ? 'en' : 'th'
  const { y, m, day } = localYMD(d)

  if (fmt === 'iso') {
    return `${y}-${pad2(m)}-${pad2(day)}`
  }

  if (fmt === 'thai') {
    const be = y + 543
    return `${pad2(day)}/${pad2(m)}/${be}`
  }

  if (fmt === 'business') {
    if (lang === 'en') {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(d)
    }
    const be = y + 543
    return `${day} ${THAI_MONTHS_SHORT[d.getMonth()]} ${be}`
  }

  return ''
}

export default formatDate
