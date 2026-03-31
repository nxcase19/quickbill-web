import { useState, useEffect } from 'react'
import api from '../services/api.js'
import { toAbsoluteUrl } from '../utils/url.js'

export default function CompanySettings() {
  const [companyName, setCompanyName] = useState('')
  const [companyNameEn, setCompanyNameEn] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')
  const [language, setLanguage] = useState('th')
  const [dateFormat, setDateFormat] = useState('thai')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [signatureUrl, setSignatureUrl] = useState(null)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [autoSignatureEnabled, setAutoSignatureEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/api/company-settings')
        const cfg = data?.settings || data
        if (cancelled || !cfg) return
        setCompanyName(cfg.company_name ?? cfg.name ?? '')
        setCompanyNameEn(cfg.company_name_en ?? '')
        setAddress(cfg.address ?? '')
        setPhone(cfg.phone ?? '')
        setTaxId(cfg.tax_id ?? '')
        setLanguage(cfg.language === 'en' ? 'en' : 'th')
        const df = cfg.date_format ?? 'thai'
        setDateFormat(['thai', 'iso', 'business'].includes(df) ? df : 'thai')
        setLogoUrl(cfg.logo_url ?? null)
        setSignatureUrl(cfg.signature_url ?? null)
        setAutoSignatureEnabled(cfg.auto_signature_enabled !== false)
      } catch {
        if (!cancelled) {
          setCompanyName('')
          setCompanyNameEn('')
          setAddress('')
          setPhone('')
          setTaxId('')
          setLanguage('th')
          setDateFormat('thai')
          setLogoUrl(null)
          setSignatureUrl(null)
          setAutoSignatureEnabled(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!phone || !String(phone).trim()) {
      alert('กรุณากรอกเบอร์โทร')
      return
    }
    setSaving(true)
    setSaveSuccess(false)
    try {
      await api.post('/api/company-settings', {
        company_name: companyName.trim(),
        company_name_en: companyNameEn.trim(),
        address: address.trim(),
        phone: phone.trim(),
        tax_id: taxId.trim(),
        language,
        date_format: dateFormat,
        auto_signature_enabled: autoSignatureEnabled,
      })
      setSaveSuccess(true)
      window.setTimeout(() => setSaveSuccess(false), 5000)
      alert('บันทึกแล้ว')
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignatureChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingSignature(true)
    try {
      const fd = new FormData()
      fd.append('signature', file)
      const { data } = await api.post('/api/company-settings/signature', fd)
      const sig = data?.signature_url ?? data?.signature?.url
      if (sig) setSignatureUrl(sig)
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'อัปโหลดลายเซ็นไม่สำเร็จ')
    } finally {
      setUploadingSignature(false)
      e.target.value = ''
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    setLogoFile(file ?? null)
    if (!file) return
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const { data } = await api.post('/api/company-settings/logo', fd)
      const logo = data?.logo_url ?? data?.logo?.url
      if (logo) setLogoUrl(logo)
      setLogoFile(null)
    } catch (err) {
      console.error(err)
      alert(err?.response?.data?.error || 'อัปโหลดโลโก้ไม่สำเร็จ')
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  const logoPreviewSrc = logoUrl ? toAbsoluteUrl(logoUrl) : null
  const signaturePreviewSrc = signatureUrl ? toAbsoluteUrl(signatureUrl) : null

  return (
    <div className="flex min-h-svh flex-col gap-8 py-8 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800 sm:text-3xl">
          ตั้งค่าบริษัท
        </h1>
        <p className="mt-2 text-slate-600">
          ข้อมูลนี้ใช้ในหัวเอกสาร PDF และการแสดงผลในระบบ
        </p>
      </div>

      {loading ? (
        <p className="text-slate-500">กำลังโหลด…</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex max-w-xl flex-col gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {saveSuccess ? (
            <p
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
            >
              บันทึกแล้ว
            </p>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              โลโก้ (ไม่บังคับ)
            </label>
            <p className="mb-2 text-sm text-slate-500">
              อัปโหลดรูปภาพ ระบบจะเก็บ URL ไว้ในการตั้งค่า
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              disabled={uploadingLogo}
              className="w-full text-lg text-slate-800 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2"
            />
            {logoFile != null && (
              <p className="mt-1 text-sm text-slate-500">เลือกไฟล์แล้ว</p>
            )}
            {uploadingLogo ? (
              <p className="mt-2 text-sm text-slate-500">กำลังอัปโหลด…</p>
            ) : null}
            {logoPreviewSrc ? (
              <div className="mt-4">
                <p className="mb-2 text-xs text-slate-500">ตัวอย่าง</p>
                <img
                  src={logoPreviewSrc}
                  alt="โลโก้บริษัท"
                  className="max-h-32 max-w-full rounded-lg border border-slate-200 bg-slate-50 object-contain p-2"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={autoSignatureEnabled}
                onChange={(e) => setAutoSignatureEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              เปิดใช้ลายเซ็นอัตโนมัติ
            </label>
            <p className="mb-3 text-sm text-slate-500">
              ปิดเพื่อไม่แสดงรูปลายเซ็นใน PDF (ยังมีเส้นให้ลงนามมือ)
            </p>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ลายเซ็น
            </label>
            <p className="mb-2 text-sm text-slate-500">
              อัปโหลดรูปลายเซ็น ระบบจะวางตามประเภทเอกสาร (เช่น ใบเสนอราคาซ้าย / ใบเสร็จขวา)
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleSignatureChange}
              disabled={uploadingSignature}
              className="w-full text-lg text-slate-800 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2"
            />
            {uploadingSignature ? (
              <p className="mt-2 text-sm text-slate-500">กำลังอัปโหลด…</p>
            ) : null}
            {signaturePreviewSrc ? (
              <div className="mt-4">
                <p className="mb-2 text-xs text-slate-500">ตัวอย่าง</p>
                <img
                  src={signaturePreviewSrc}
                  alt="ลายเซ็น"
                  className="max-h-24 max-w-full rounded-lg border border-slate-200 bg-slate-50 object-contain p-2"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อบริษัท (ภาษาไทย)
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
              placeholder="ชื่อบริษัทหรือร้านค้า"
              autoComplete="organization"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Company name (English)
            </label>
            <input
              type="text"
              value={companyNameEn}
              onChange={(e) => setCompanyNameEn(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
              placeholder="Optional English name"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ที่อยู่
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
              placeholder="ที่อยู่สำหรับออกเอกสาร"
            />
          </div>

          <div className="form-group">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              เบอร์โทร
            </label>
            <input
              type="text"
              name="phone"
              value={phone || ''}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="เช่น 0812345678"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
              autoComplete="tel"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              เลขผู้เสียภาษี
            </label>
            <input
              type="text"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
              placeholder="เลขประจำตัวผู้เสียภาษี (ถ้ามี)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ภาษา
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
            >
              <option value="th">ไทย</option>
              <option value="en">English</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              รูปแบบวันที่
            </label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-lg text-slate-800 focus:border-slate-400 focus:outline-none"
            >
              <option value="thai">Thai</option>
              <option value="iso">ISO</option>
              <option value="business">Business</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-6 py-4 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </form>
      )}
    </div>
  )
}
