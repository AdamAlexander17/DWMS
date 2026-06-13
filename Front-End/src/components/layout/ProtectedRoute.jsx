import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function ProtectedRoute({ children, roles, modules, action = 'view' }) {
  const { user, accessToken, hasAnyModulePermission } = useAuthStore()

  if (!accessToken || !user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  if (modules && !hasAnyModulePermission(modules, action)) return <Navigate to="/" replace />

  // must_change_password is handled by the ProfileDrawer (auto-opens in force mode)
  return children
}
