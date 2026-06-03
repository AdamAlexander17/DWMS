import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { User, Lock, Save } from 'lucide-react'
import { getProfile, changePassword } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { PageSpinner } from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'

export default function Profile() {
  const { user: storeUser } = useAuthStore()
  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const profile = data?.data?.data

  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [pwMsg, setPwMsg]   = useState(null)
  const [pwLoading, setPwLoading] = useState(false)

  const handleChangePw = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwMsg({ ok: false, text: 'New passwords do not match' }); return
    }
    setPwLoading(true)
    try {
      await changePassword(pwForm)
      setPwMsg({ ok: true, text: 'Password changed successfully' })
      setPwForm({ old_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.message || 'Failed to change password' })
    } finally {
      setPwLoading(false)
    }
  }

  if (isLoading) return <PageSpinner />

  const u = profile || storeUser

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your account information</p>
      </div>

      {/* Info card */}
      <div className="card">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-sidebar-bg flex items-center justify-center shrink-0">
            <span className="text-accent font-black text-2xl">
              {(u?.username || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">@{u?.username}</h2>
            <p className="text-gray-400 text-sm">@{u?.username}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant={u?.role} />
              <Badge variant={u?.is_active ? 'active' : 'inactive'} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: 'Username',   value: u?.username },
            { label: 'Mobile',     value: u?.mobile || '—' },
            { label: 'Role',       value: u?.role },
            { label: 'Brand',      value: u?.brand_detail?.name || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
              <p className="text-gray-800 font-medium">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Change password */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <Lock size={17} className="text-accent-dark" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">Change Password</h3>
            <p className="text-gray-400 text-xs">Keep your account secure</p>
          </div>
        </div>

        <form onSubmit={handleChangePw} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
            <input type="password" className="input" value={pwForm.old_password}
              onChange={(e) => setPwForm({ ...pwForm, old_password: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <input type="password" className="input" value={pwForm.new_password}
              onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} required minLength={8} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
            <input type="password" className="input" value={pwForm.confirm_password}
              onChange={(e) => setPwForm({ ...pwForm, confirm_password: e.target.value })} required />
          </div>

          {pwMsg && (
            <div className={`px-4 py-3 rounded-lg text-sm ${pwMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {pwMsg.text}
            </div>
          )}

          <button type="submit" disabled={pwLoading} className="btn-primary">
            <Save size={15} />
            {pwLoading ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
