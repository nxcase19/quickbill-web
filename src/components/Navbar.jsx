import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useBilling } from '../context/BillingContext.jsx'
import { clearStoredAuth, getStoredToken } from '../utils/authClient.js'
import { clearBillingPlanCache, showPricingUpgradeCta } from '../utils/planClient.js'

const navLinks = [
  { to: '/dashboard', label: 'แดชบอร์ด' },
  { to: '/create', label: 'ออกบิล' },
  { to: '/history', label: 'ประวัติ' },
  { to: '/customers', label: 'ลูกค้า' },
  { to: '/purchases', label: 'ภาษีซื้อ', feature: 'tax_purchase' },
  { to: '/purchase-orders', label: 'ใบสั่งซื้อ', feature: 'purchase_orders' },
  { to: '/suppliers', label: 'ผู้ขาย' },
  { to: '/company-settings', label: 'ตั้งค่าบริษัท' },
]

function ProBadge() {
  return (
    <span className="ml-1.5 align-middle rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
      PRO
    </span>
  )
}

function NavEntry({ to, label, feature, onCloseMenu, variant }) {
  const { billingFeatureEnabled, openUpgrade, effectivePlan, trialActive } = useBilling()
  const plan = String(effectivePlan ?? 'free').toLowerCase()
  const isPaid = plan === 'pro' || plan === 'basic'
  const isTrial = plan === 'trial' || trialActive === true
  const locked =
    feature != null && !isPaid && !isTrial && !billingFeatureEnabled(feature)
  const base =
    variant === 'mobile'
      ? 'min-h-11 w-full rounded-lg px-4 py-3 text-left text-base font-medium transition'
      : 'rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-100 lg:px-4 lg:text-base'

  if (locked) {
    return (
      <button
        type="button"
        className={`${base} text-slate-500`}
        onClick={() => {
          openUpgrade('อัปเกรดเพื่อใช้งานฟีเจอร์นี้')
          onCloseMenu?.()
        }}
      >
        {label}
        <ProBadge />
      </button>
    )
  }

  return (
    <Link
      to={to}
      className={`${base} text-slate-700`}
      onClick={() => onCloseMenu?.()}
    >
      {label}
    </Link>
  )
}

function AuthShellNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="app-container flex min-h-14 items-center justify-center py-2">
        <span className="text-lg font-bold text-slate-900">QuickBill</span>
      </div>
    </header>
  )
}

function MainAppNavbar() {
  const { plan } = useBilling()
  const showUpgradeNav = showPricingUpgradeCta(plan)
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleLogout() {
    clearStoredAuth()
    clearBillingPlanCache()
    setOpen(false)
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="app-container flex min-h-14 items-center justify-between gap-3 py-2">
        <Link
          to="/dashboard"
          className="text-lg font-bold text-slate-900"
          onClick={() => setOpen(false)}
        >
          QuickBill
        </Link>

        <nav className="hidden items-center gap-1 lg:gap-2 md:flex" aria-label="หลัก">
          {navLinks.map((item) => (
            <NavEntry key={item.to} {...item} />
          ))}
          {showUpgradeNav ? (
            <Link
              to="/pricing"
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 lg:px-4 lg:text-base"
              onClick={() => setOpen(false)}
            >
              อัปเกรด
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 lg:px-4 lg:text-base"
          >
            ออกจากระบบ
          </button>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"
          >
            ออก
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-drawer"
            aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}
          >
            {open ? (
              <span className="text-xl leading-none" aria-hidden>
                ×
              </span>
            ) : (
              <span className="text-lg leading-none" aria-hidden>
                ☰
              </span>
            )}
          </button>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
            aria-label="ปิดเมนู"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-drawer"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(100vw-2.5rem,20rem)] flex-col border-l border-slate-200 bg-white shadow-xl md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="เมนูนำทาง"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="font-semibold text-slate-800">เมนู</span>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-2xl text-slate-600"
                onClick={() => setOpen(false)}
                aria-label="ปิด"
              >
                ×
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="มือถือ">
              {navLinks.map((item) => (
                <NavEntry key={item.to} {...item} variant="mobile" onCloseMenu={() => setOpen(false)} />
              ))}
              {showUpgradeNav ? (
                <Link
                  to="/pricing"
                  className="min-h-11 w-full rounded-lg bg-amber-500 px-4 py-3 text-center text-base font-semibold text-white"
                  onClick={() => setOpen(false)}
                >
                  อัปเกรดแพ็กเกจ
                </Link>
              ) : null}
              <button
                type="button"
                className="min-h-11 w-full rounded-lg px-4 py-3 text-left text-base font-medium text-slate-700 hover:bg-slate-50"
                onClick={handleLogout}
              >
                ออกจากระบบ
              </button>
            </nav>
          </div>
        </>
      ) : null}
    </header>
  )
}

export default function Navbar() {
  const location = useLocation()
  const token = getStoredToken()

  if (location.pathname === '/login' || location.pathname === '/register') {
    return <AuthShellNavbar />
  }

  if (!token) {
    return <AuthShellNavbar />
  }

  return <MainAppNavbar />
}
