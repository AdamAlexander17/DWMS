import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function ProtectedRoute({ children, roles }) {
  const { user, accessToken } = useAuthStore()
  const location = useLocation()

  if (!accessToken || !user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />

  // Force password change on first login
  if (user.must_change_password && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace state={{ forcePasswordChange: true }} />
  }

  return children
}
