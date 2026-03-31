/**
 * HTML fragment: signature section for QT / INV / RC (before </body>).
 * @param {object} doc - document row with doc_type
 * @returns {string}
 */
export function buildPdfSignatureSection(doc) {
  let leftLabel = ''
  let rightLabel = ''

  const docType = String(doc.doc_type ?? '').toUpperCase()

  if (docType === 'RC') {
    leftLabel = 'ผู้รับเงิน'
    rightLabel = 'ผู้ชำระเงิน'
  }

  if (docType === 'INV') {
    leftLabel = 'ผู้ออกบิล'
    rightLabel = 'ผู้รับแจ้งหนี้'
  }

  if (docType === 'QT') {
    leftLabel = 'ผู้เสนอราคา'
    rightLabel = 'ผู้รับการเสนอ'
  }

  return `
<div style="margin-top: 60px; display: flex; justify-content: space-between;">
  <div style="text-align: center; width: 45%;">
    <div>__________________________</div>
    <div>${leftLabel}</div>
    <div>วันที่ __________________</div>
  </div>
  <div style="text-align: center; width: 45%;">
    <div>__________________________</div>
    <div>${rightLabel}</div>
    <div>วันที่ __________________</div>
  </div>
</div>
`.trim()
}

/**
 * Insert signature HTML immediately before </body> (case-sensitive).
 * @param {string} html
 * @param {object} doc
 * @returns {string}
 */
export function injectSignatureBeforeBodyClose(html, doc) {
  const section = buildPdfSignatureSection(doc)
  return html.replace('</body>', `${section}\n</body>`)
}
