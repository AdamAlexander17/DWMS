import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Tag, QrCode, Wallet,
  Building2, ScrollText, UserCircle, LogOut, ChevronRight, Shield,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { logout as apiLogout } from '../../api/auth'

const allNavItems = [
  { to: '/',              label: 'Dashboard',     icon: LayoutDashboard, roles: ['admin', 'back_office', 'rm'] },
  { to: '/users',         label: 'Users',         icon: Users,           roles: ['admin'] },
  { to: '/roles',         label: 'Roles',         icon: Shield,          roles: ['admin'] },
  { to: '/brands',        label: 'Brands',        icon: Tag,             roles: ['admin'] },
  { to: '/qr-codes',      label: 'QR Codes',      icon: QrCode,          roles: ['admin', 'back_office', 'rm'] },
  { to: '/upi-sources',   label: 'UPI Sources',   icon: Wallet,          roles: ['admin', 'back_office', 'rm'] },
  { to: '/bank-accounts', label: 'Bank Accounts', icon: Building2,       roles: ['admin', 'back_office', 'rm'] },
  { to: '/audit-logs',    label: 'Audit Logs',    icon: ScrollText,      roles: ['admin'] },
  { to: '/profile',       label: 'Profile',       icon: UserCircle,      roles: ['admin', 'back_office', 'rm'] },
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
    <aside className="fixed inset-y-0 left-0 w-64 flex flex-col bg-sidebar-bg z-30 select-none">
      {/* Brand / Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <span className="text-sidebar-bg font-black text-base leading-none">D</span>
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight tracking-wide">DWMS</p>
          <p className="text-sidebar-text text-[11px] leading-tight">Deposit Management</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-accent text-sidebar-bg shadow-sm'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {isActive && <ChevronRight size={14} className="opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
            <span className="text-accent font-bold text-sm">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.username}</p>
            <p className="text-sidebar-text text-[11px] truncate">{roleLabel[user?.role] || user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-sidebar-text hover:text-red-400 transition-colors p-1 rounded"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
