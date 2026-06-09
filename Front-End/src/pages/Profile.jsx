import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { User, Lock, Save, Settings, Clock, AlertTriangle, ShieldCheck, AtSign, Layers, CircleDot, BadgeCheck } from 'lucide-react'
import { getProfile, changePassword } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { PageSpinner } from '../components/ui/Spinner'
import { strongPassword as vStrongPw, extractApiErrors } from '../utils/validators'

const roleLabel = { admin: 'Admin', back_office: 'Back Office', rm: 'RM' }
const roleColor = {
  admin:       'bg-amber-100 text-amber-700 border-amber-200',
  back_office: 'bg-purple-100 text-purple-700 border-purple-200',
  rm:          'bg-blue-100 text-blue-700 border-blue-200',
}

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
  const [pwErrors, setPwErrors]   = useState({})

  const validatePw = () => {
    const errs = {}
    if (!pwForm.old_password) errs.old_password = 'Current password is required.'
    const newErr = vStrongPw(pwForm.new_password)
    if (newErr) errs.new_password = newErr
    if (pwForm.old_password && pwForm.new_password && pwForm.old_password === pwForm.new_password) {
      errs.new_password = 'New password must be different from the current password.'
    }
    if (!pwForm.confirm_password) errs.confirm_password = 'Please confirm your new password.'
    else if (pwForm.confirm_password !== pwForm.new_password) errs.confirm_password = 'Passwords do not match.'
    setPwErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleChangePw = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    if (!validatePw()) return
    setPwLoading(true)
    try {
      await changePassword(pwForm)
      setPwMsg({ ok: true, text: 'Password changed successfully' })
      setPwForm({ old_password: '', new_password: '', confirm_password: '' })
      setPwErrors({})
      clearMustChangePassword()
    } catch (err) {
      const fe = extractApiErrors(err)
      setPwErrors({
        ...(fe.old_password     ? { old_password: fe.old_password } : {}),
        ...(fe.new_password     ? { new_password: fe.new_password } : {}),
        ...(fe.confirm_password ? { confirm_password: fe.confirm_password } : {}),
      })
      setPwMsg({ ok: false, text: fe.non_field || err.response?.data?.message || 'Failed to change password' })
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
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="text-xs text-gray-400 mt-1">Manage your account information and security</p>
        </div>
        {tab === 'password' && (
          <button type="submit" form="pw-form" disabled={pwLoading} className="btn-primary">
            <Save size={14} /> {pwLoading ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Force password change banner */}
      {forceChange && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-500" />
          <p className="text-sm font-medium">You are using a temporary password. Please change your password before continuing.</p>
        </div>
      )}

      <div className="grid gap-6" style={{ gridTemplateColumns: '280px 1fr' }}>

        {/* ── Left sidebar ── */}
        <div className="card p-0 overflow-hidden">
          {/* Hero */}
          <div className="relative px-5 pt-7 pb-5 bg-gradient-to-br from-accent/8 via-accent/4 to-transparent border-b border-gray-100">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent/5" />
            <div className="relative flex flex-col items-center text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center shadow-lg shadow-accent/20">
                  <span className="text-white font-black text-3xl">{initials}</span>
                </div>
                {u?.is_active && (
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-white flex items-center justify-center shadow-sm">
                    <BadgeCheck size={16} className="text-green-500" fill="currentColor" stroke="white" />
                  </span>
                )}
              </div>
              <p className="mt-3 text-base font-bold text-gray-800">@{u?.username}</p>
              <span className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roleColor[u?.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                <ShieldCheck size={10} /> {role}
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-2.5 space-y-0.5">
            {NAV.map(({ id, label, icon: Icon, active }) => (
              <button
                key={id}
                onClick={() => active && setTab(id)}
                disabled={!active}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left
                  ${tab === id
                    ? 'bg-accent text-white shadow-sm shadow-accent/20'
                    : active
                      ? 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      : 'text-gray-300 cursor-not-allowed'}`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {!active && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Soon</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Right content card ── */}
        <div className="card p-0 overflow-hidden">

          {/* Profile tab */}
          {tab === 'profile' && (
            <div>
              <div className="px-7 py-5 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <User size={15} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Account Information</h2>
                  <p className="text-[11px] text-gray-400">Read-only — contact an administrator to update these details</p>
                </div>
              </div>

              <div className="px-7 py-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: AtSign,     label: 'Username',  value: u?.username },
                  { icon: ShieldCheck,label: 'Role',      value: role },
                  { icon: Layers,     label: 'Brands',    value: brands },
                  { icon: CircleDot,  label: 'Status',    value: u?.is_active ? 'Active' : 'Inactive', tone: u?.is_active ? 'green' : 'red' },
                ].map(({ icon: Icon, label, value, tone }) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-gray-50/40 px-4 py-3 hover:border-accent/30 hover:bg-white transition-colors">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <Icon size={11} /> {label}
                    </div>
                    <p className={`mt-1.5 text-sm font-semibold truncate ${
                      tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-500' : 'text-gray-800'
                    }`}>
                      {value || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Password tab */}
          {tab === 'password' && (
            <div>
              <div className="px-7 py-5 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Lock size={15} className="text-accent" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Change Password</h2>
                  <p className="text-[11px] text-gray-400">Use a strong, unique password you don't use anywhere else</p>
                </div>
              </div>

              <div className="px-7 py-6">
                <form id="pw-form" onSubmit={handleChangePw} className="space-y-4 max-w-md">
                  {[
                    { key: 'old_password',     label: 'Current Password',     ph: 'Enter current password' },
                    { key: 'new_password',     label: 'New Password',         ph: 'Min 8 chars, upper, lower, digit, symbol' },
                    { key: 'confirm_password', label: 'Confirm New Password', ph: 'Repeat new password' },
                  ].map(({ key, label, ph }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
                      <input
                        type="password" placeholder={ph}
                        className={`input ${pwErrors[key] ? 'border-red-300' : ''}`}
                        value={pwForm[key]}
                        onChange={(e) => { setPwForm({ ...pwForm, [key]: e.target.value }); if (pwErrors[key]) setPwErrors(p => ({ ...p, [key]: undefined })) }}
                        maxLength={128}
                        autoComplete={key === 'old_password' ? 'current-password' : 'new-password'}
                      />
                      {pwErrors[key] && <p className="mt-1 text-xs text-red-600">{pwErrors[key]}</p>}
                    </div>
                  ))}
                  {/* Strength helper */}
                  {pwForm.new_password && (
                    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password Requirements</p>
                      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {[
                          { label: '8+ characters',    ok: pwForm.new_password.length >= 8 },
                          { label: 'Uppercase letter', ok: /[A-Z]/.test(pwForm.new_password) },
                          { label: 'Lowercase letter', ok: /[a-z]/.test(pwForm.new_password) },
                          { label: 'Digit',            ok: /\d/.test(pwForm.new_password) },
                          { label: 'Symbol',           ok: /[^A-Za-z0-9]/.test(pwForm.new_password) },
                        ].map(r => (
                          <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? 'text-green-600' : 'text-gray-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? 'bg-green-500' : 'bg-gray-300'}`} />{r.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pwMsg && (
                    <div className={`px-3 py-2 rounded-lg text-xs ${pwMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                      {pwMsg.text}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
