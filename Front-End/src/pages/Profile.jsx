import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { User, Lock, Save, Pencil, Settings, Clock, AlertTriangle } from 'lucide-react'
import { getProfile, changePassword } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { PageSpinner } from '../components/ui/Spinner'

const roleLabel = { admin: 'Admin', back_office: 'Back Office', rm: 'RM' }

const NAV = [
  { id: 'profile',     label: 'Profile',      icon: User,     active: true  },
  { id: 'password',    label: 'Password',     icon: Lock,     active: true  },
  { id: 'preferences', label: 'Preferences',  icon: Settings, active: false },
  { id: 'activity',    label: 'Activity Log', icon: Clock,    active: false },
]

export default function Profile() {
  const { user: storeUser, clearMustChangePassword } = useAuthStore()
  const location = useLocation()
  const forceChange = !!location.state?.forcePasswordChange || !!storeUser?.must_change_password
  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const u = data?.data?.data || storeUser

  const [tab, setTab] = useState(forceChange ? 'password' : 'profile')
  const [pwForm, setPwForm]   = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [pwMsg, setPwMsg]     = useState(null)
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
      clearMustChangePassword()
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.message || 'Failed to change password' })
    } finally {
      setPwLoading(false)
    }
  }

  if (isLoading) return <PageSpinner />

  const initials = (u?.username || 'U')[0].toUpperCase()
  const role     = roleLabel[u?.role] ?? u?.role
  const brands   = u?.brands_detail?.length ? u.brands_detail.map(b => b.name).join(', ') : '—'

  return (
    <div className="space-y-6">
      <h1 className="page-title">Edit Profile</h1>

      {/* Force password change banner */}
      {forceChange && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
          <p className="text-sm font-medium">You are using a temporary password. Please change your password before continuing.</p>
        </div>
      )}

      <div className="grid gap-6" style={{ gridTemplateColumns: '260px 1fr' }}>

        {/* ── Left sidebar ── */}
        <div className="card flex flex-col items-center pt-8 pb-6 px-5">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-full bg-accent/10 border-4 border-accent/20 flex items-center justify-center mb-3">
            <span className="text-accent font-black text-4xl">{initials}</span>
          </div>
          <p className="text-base font-bold text-gray-800">@{u?.username}</p>
          <p className="text-xs text-gray-400 mt-0.5">{role}</p>

          <div className="w-full border-t border-gray-100 my-5" />

          {/* Nav */}
          <nav className="w-full space-y-0.5">
            {NAV.map(({ id, label, icon: Icon, active }) => (
              <button
                key={id}
                onClick={() => active && setTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                  ${tab === id ? 'bg-accent/8 text-accent' : active ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-800' : 'text-gray-300 cursor-not-allowed'}`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Right content card ── */}
        <div className="card p-0 overflow-hidden">

          {/* Top bar */}
          <div className="flex items-center gap-1 px-6 py-0 border-b border-gray-100">
            <div className="flex items-stretch flex-1 gap-0">
              {[
                { id: 'profile',  label: 'Profile',         icon: User },
                { id: 'password', label: 'Change Password',  icon: Lock },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setPwMsg(null) }}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-semibold border-b-2 transition-colors
                    ${tab === id ? 'border-accent text-accent' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>
            {tab === 'password' && (
              <button type="submit" form="pw-form" disabled={pwLoading} className="btn-primary ml-auto">
                <Save size={14} /> {pwLoading ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="px-8 py-7">

            {/* Profile tab */}
            {tab === 'profile' && (
              <>
                <div className="flex items-center gap-2.5 mb-4">
                  <User size={18} className="text-gray-700" />
                  <h2 className="text-base font-bold text-gray-800">Profile</h2>
                </div>
                <div className="border-t border-gray-100 mb-6" />
                <div className="grid grid-cols-2 gap-x-10 gap-y-0">
                  {[
                    { label: 'Username', value: u?.username },
                    { label: 'Role',     value: role },
                    { label: 'Brand',    value: brands },
                    { label: 'Status',   value: u?.is_active ? 'Active' : 'Inactive' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-4 border-b border-gray-50">
                      <span className="text-sm text-gray-500 font-medium">{label}:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">{value}</span>
                        <button
                          title={`Edit ${label}`}
                          className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20 transition-colors"
                        >
                          <Pencil size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Password tab */}
            {tab === 'password' && (
              <>
                <div className="flex items-center gap-2.5 mb-4">
                  <Lock size={18} className="text-gray-700" />
                  <h2 className="text-base font-bold text-gray-800">Change Password</h2>
                </div>
                <div className="border-t border-gray-100 mb-6" />
                <form id="pw-form" onSubmit={handleChangePw} className="space-y-4 max-w-sm">
                  {[
                    { key: 'old_password',     label: 'Current Password',     ph: 'Enter current password' },
                    { key: 'new_password',     label: 'New Password',         ph: 'Min 8 characters' },
                    { key: 'confirm_password', label: 'Confirm New Password', ph: 'Repeat new password' },
                  ].map(({ key, label, ph }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
                      <input
                        type="password" placeholder={ph} className="input"
                        value={pwForm[key]}
                        onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                        required minLength={key === 'new_password' ? 8 : undefined}
                      />
                    </div>
                  ))}
                  {pwMsg && (
                    <div className={`px-3 py-2 rounded-lg text-xs ${pwMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {pwMsg.text}
                    </div>
                  )}
                </form>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
