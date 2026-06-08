import { NavLink, useNavigate } from 'react-router-dom'
import { Users, QrCode, Wallet, Building2, ScrollText, LogOut, Shield, ArrowDownCircle, ArrowUpCircle, Landmark, LayoutDashboard, Tag, SlidersHorizontal } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'
import NotificationBell from '../ui/NotificationBell'

const allNavItems = [
  { to: '/',              label: 'Dashboard',    roles: ['admin', 'back_office', 'rm'] },
  { to: '/users',         label: 'Users',        roles: ['admin'] },
  { to: '/roles',         label: 'Roles',        roles: ['admin'] },
  { to: '/brands',        label: 'Brands',       roles: ['admin'] },
  { to: '/qr-codes',      label: 'QR Codes',     roles: ['admin', 'back_office', 'rm'] },
  { to: '/upi-sources',   label: 'UPI Sources',  roles: ['admin', 'back_office', 'rm'] },
  { to: '/bank-accounts', label: 'Bank Accounts',roles: ['admin', 'back_office', 'rm'] },
  { to: '/deposits',      label: 'Deposits',     icon: ArrowDownCircle, roles: ['admin', 'back_office', 'rm'] },
  { to: '/withdrawals',         label: 'Withdrawals',         icon: ArrowUpCircle,   roles: ['admin', 'back_office', 'rm'] },
  { to: '/withdrawal-history',  label: 'Withdrawal History',  roles: ['admin', 'back_office', 'rm'] },
  { to: '/gateways',            label: 'Master',              roles: ['admin'] },
  { to: '/audit-logs',          label: 'Audit Logs',          icon: ScrollText,      roles: ['admin'] },
]

const roleLabel = { admin: 'Administrator', back_office: 'Back Office', rm: 'Relationship Manager' }

export default function Sidebar() {
  const { user, refreshToken, logout } = useAuthStore()
  const navigate = useNavigate()

  const navItems = allNavItems.filter((item) => item.roles.includes(user?.role))

  const handleLogout = async () => {
    try { await apiLogout(refreshToken) } catch {}
    logout()
    navigate('/login')
  }

  const initials = user?.username?.[0]?.toUpperCase() ?? 'U'

  return (
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

        {/* Nav Links */}
        <div className="flex items-stretch flex-1 overflow-x-auto">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0 pl-4 border-l border-gray-200">
          <NotificationBell />
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2.5 group"
            title="My Profile"
          >
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 group-hover:bg-accent/20 transition-colors">
              <span className="text-accent font-bold text-xs">{initials}</span>
            </div>
            <div className="hidden lg:block leading-tight text-left">
              <p className="text-sm font-semibold text-gray-800">{user?.username}</p>
              <p className="text-[11px] text-gray-400">{roleLabel[user?.role] ?? user?.role}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-gray-50"
          >
            <LogOut size={16} />
          </button>
        </div>

      </div>
    </nav>
  )
}
