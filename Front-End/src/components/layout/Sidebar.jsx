import { useEffect } from 'react'
import { useNavigate, useLocation, NavLink } from 'react-router-dom'
import { LogOut, Landmark, UserCog, Layers, Network, QrCode, Smartphone, Building2, ArrowDownCircle, ArrowUpCircle, ClipboardList, LayoutDashboard, Users, Database, Wallet, ArrowLeftRight, ScrollText } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'
import NotificationBell from '../ui/NotificationBell'
import ProfileDrawer from './ProfileDrawer'

export const MASTER_PATHS  = ['/roles', '/brands', '/gateways']
export const PAYMENT_PATHS = ['/qr-codes', '/upi-sources', '/bank-accounts']
export const TXN_PATHS     = ['/deposits', '/deposit-history', '/withdrawals', '/withdrawal-history']

const MASTER_TABS = [
  { to: '/roles',    label: 'Roles',    icon: UserCog },
  { to: '/brands',   label: 'Brands',   icon: Layers },
  { to: '/gateways', label: 'Gateways', icon: Network },
]

const PAYMENT_TABS = [
  { to: '/qr-codes',      label: 'QR Codes',      icon: QrCode },
  { to: '/upi-sources',   label: 'UPI Sources',   icon: Smartphone },
  { to: '/bank-accounts', label: 'Bank Accounts', icon: Building2 },
]

const TXN_TABS = [
  { to: '/deposits',           label: 'Deposits',           icon: ArrowDownCircle, module: 'deposits' },
  { to: '/withdrawals',        label: 'Withdrawals',        icon: ArrowUpCircle,   module: 'withdrawals' },
  { to: '/deposit-history',    label: 'Deposit History',    icon: ClipboardList,   module: 'deposit_history' },
  { to: '/withdrawal-history', label: 'Withdrawal History', icon: ClipboardList,   module: 'withdrawal_history' },
]

const allNavItems = [
  { to: '/',           label: 'Dashboard',        icon: LayoutDashboard, modules: [] },
  { to: '/users',      label: 'Users',            icon: Users,           modules: ['users'] },
  { to: '/roles',      label: 'Master',           icon: Database,        modules: ['master'], master:  true },
  { to: '/qr-codes',   label: 'Payment Methods',  icon: Wallet,          modules: ['payment_methods'], payment: true },
  { to: '/deposits',   label: 'Transactions',     icon: ArrowLeftRight,  modules: ['transactions'], txn:     true },
  { to: '/audit-logs', label: 'Audit Logs',       icon: ScrollText,      modules: ['audit_logs'] },
]

const roleLabel = { admin: 'Administrator', back_office: 'Back Office', rm: 'Relationship Manager' }

export default function Sidebar() {
  const { user, refreshToken, logout, openProfile, hasAnyModulePermission } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Determine the first accessible sub-tab for each group
  const firstMasterTab  = MASTER_TABS.find(t => {
    if (t.to === '/roles') return hasAnyModulePermission(['roles'])
    if (t.to === '/brands') return hasAnyModulePermission(['brands'])
    if (t.to === '/gateways') return hasAnyModulePermission(['gateways'])
    return false
  })
  const firstPaymentTab = PAYMENT_TABS.find(t => {
    if (t.to === '/qr-codes') return hasAnyModulePermission(['qr_codes'])
    if (t.to === '/upi-sources') return hasAnyModulePermission(['upi_sources'])
    if (t.to === '/bank-accounts') return hasAnyModulePermission(['bank_accounts'])
    return false
  })
  const firstTxnTab = TXN_TABS.find(t => {
    if (t.to === '/deposits') return hasAnyModulePermission(['deposits'])
    if (t.to === '/withdrawals') return hasAnyModulePermission(['withdrawals'])
    if (t.to === '/deposit-history') return hasAnyModulePermission(['deposit_history'])
    if (t.to === '/withdrawal-history') return hasAnyModulePermission(['withdrawal_history'])
    return false
  })

  const navItems = allNavItems.filter((item) => item.modules.length === 0 || hasAnyModulePermission(item.modules)).map(item => {
    // Override the `to` path to point to the first accessible sub-tab
    if (item.master && firstMasterTab) return { ...item, to: firstMasterTab.to }
    if (item.payment && firstPaymentTab) return { ...item, to: firstPaymentTab.to }
    if (item.txn && firstTxnTab) return { ...item, to: firstTxnTab.to }
    return item
  })
  const masterActive  = MASTER_PATHS.some(p => location.pathname.startsWith(p))
  const paymentActive = PAYMENT_PATHS.some(p => location.pathname.startsWith(p))
  const txnActive     = TXN_PATHS.some(p => location.pathname.startsWith(p))
  const activeGroup   = masterActive ? 'master' : paymentActive ? 'payment' : txnActive ? 'txn' : null
  const subTabs       = (activeGroup === 'master' ? MASTER_TABS
                      : activeGroup === 'payment' ? PAYMENT_TABS
                      : activeGroup === 'txn'     ? TXN_TABS
                      : []).filter((tab) => {
                        if (tab.to === '/roles') return hasAnyModulePermission(['roles'])
                        if (tab.to === '/brands') return hasAnyModulePermission(['brands'])
                        if (tab.to === '/gateways') return hasAnyModulePermission(['gateways'])
                        if (tab.to === '/qr-codes') return hasAnyModulePermission(['qr_codes'])
                        if (tab.to === '/upi-sources') return hasAnyModulePermission(['upi_sources'])
                        if (tab.to === '/bank-accounts') return hasAnyModulePermission(['bank_accounts'])
                        if (tab.to === '/deposits') return hasAnyModulePermission(['deposits'])
                        if (tab.to === '/deposit-history') return hasAnyModulePermission(['deposit_history'])
                        if (tab.to === '/withdrawals') return hasAnyModulePermission(['withdrawals'])
                        if (tab.to === '/withdrawal-history') return hasAnyModulePermission(['withdrawal_history'])
                        return true
                      })

  // Auto-open profile drawer in force mode when user must change password
  useEffect(() => {
    if (user?.must_change_password) openProfile({ force: true })
  }, [user?.must_change_password, openProfile])

  const handleLogout = async () => {
    try { await apiLogout(refreshToken) } catch {}
    logout()
    navigate('/login')
  }

  const initials = user?.username?.[0]?.toUpperCase() ?? 'U'

  return (
    <>
      {/* ── Row 1: Main navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm select-none">
        <div className="flex items-stretch h-14 px-6">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0 pr-5 border-r border-gray-200 mr-4">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Landmark size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-gray-900 font-bold text-sm leading-tight">DWMS</p>
              <p className="text-gray-400 text-[10px] leading-tight">Deposit Management</p>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex items-stretch flex-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={() => {
                  const active = item.master
                    ? masterActive
                    : item.payment
                    ? paymentActive
                    : item.txn
                    ? txnActive
                    : location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
                  return `flex items-center gap-1.5 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-150 ${
                    active
                      ? 'border-accent text-accent'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`
                }}
              >
                <item.icon size={14} className="shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0 pl-4 border-l border-gray-200">
            <NotificationBell />
            <button onClick={() => openProfile()} className="flex items-center gap-2.5 group" title="My Profile">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
                <span className="text-accent font-bold text-xs">{initials}</span>
              </div>
              <div className="hidden lg:block leading-tight text-left">
                <p className="text-sm font-semibold text-gray-800">{user?.username}</p>
                <p className="text-[11px] text-gray-400">{roleLabel[user?.role] ?? user?.role}</p>
              </div>
            </button>
            <button onClick={handleLogout} title="Logout"
              className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-gray-50">
              <LogOut size={16} />
            </button>
          </div>

        </div>
      </nav>

      {/* ── Row 2: Sub-tab strip (Master or Payment Methods) ── */}
      {activeGroup && (
        <div className="fixed top-14 left-0 right-0 z-20 bg-white border-b border-gray-200 select-none">
          <div className="flex items-stretch h-10 px-6 gap-1">
            {subTabs.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-150 ${
                    isActive
                      ? 'border-accent text-accent'
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                  }`
                }
              >
                <Icon size={13} strokeWidth={2} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Profile slide-in drawer */}
      <ProfileDrawer />
    </>
  )
}
