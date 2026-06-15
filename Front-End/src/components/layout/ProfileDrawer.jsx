import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  User, Lock, Save, AlertTriangle, ShieldCheck, AtSign, Layers,
  CircleDot, BadgeCheck, X, LogOut,
} from 'lucide-react'
import { getProfile, changePassword } from '../../api/auth'
import { useAuthStore } from '../../store/authStore'
import { strongPassword as vStrongPw, extractApiErrors } from '../../utils/validators'

const roleLabel = { admin: 'Admin', back_office: 'Back Office', rm: 'RM' }
const roleColor = {
  admin:       'bg-amber-100 text-amber-700 border-amber-200',
  back_office: 'bg-purple-100 text-purple-700 border-purple-200',
  rm:          'bg-blue-100 text-blue-700 border-blue-200',
}

export default function ProfileDrawer() {
  const {
    user: storeUser, profileDrawerOpen, profileForceChange,
    closeProfile, clearMustChangePassword, logout,
  } = useAuthStore()

  const { data } = useQuery({
    queryKey: ['profile'],
    queryFn:  getProfile,
    enabled:  profileDrawerOpen,
  })
  const u = data?.data?.data || storeUser

  const [tab, setTab] = useState('profile')
  const [pwForm,   setPwForm]   = useState({ old_password: '', new_password: '', confirm_password: '' })
  const [pwErrors, setPwErrors] = useState({})
  const [pwMsg,    setPwMsg]    = useState(null)
  const [pwLoading, setPwLoading] = useState(false)

  // ── When forced, lock to password tab ──
  useEffect(() => {
    if (profileForceChange) setTab('password')
  }, [profileForceChange])

  // ── Reset state on close ──
  useEffect(() => {
    if (!profileDrawerOpen) {
      setPwForm({ old_password: '', new_password: '', confirm_password: '' })
      setPwErrors({}); setPwMsg(null)
      setTab(profileForceChange ? 'password' : 'profile')
    }
  }, [profileDrawerOpen, profileForceChange])

  // ── ESC closes (unless forced) ──
  useEffect(() => {
    if (!profileDrawerOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeProfile() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [profileDrawerOpen, closeProfile])

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

  if (!profileDrawerOpen) return null

  const initials = (u?.username || 'U')[0].toUpperCase()
  const role     = roleLabel[u?.role] ?? u?.role
  const brands   = u?.brands_detail?.length ? u.brands_detail.map(b => b.name).join(', ') : '—'

  return (
    <>
      {/* Backdrop — sits below the navbar */}
      <div
        onClick={() => !profileForceChange && closeProfile()}
        className={`fixed left-0 right-0 bottom-0 top-14 z-30 bg-gray-900/30 backdrop-blur-[2px] transition-opacity ${profileForceChange ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      />

      {/* Drawer — slides in from right, below the navbar */}
      <aside
        className="fixed top-14 right-0 z-40 w-full sm:w-[320px] bg-white shadow-2xl border-t border-l border-gray-200 flex flex-col rounded-bl-2xl overflow-hidden"
        style={{ height: 'calc(100vh - 3.5rem)', animation: 'slideInRight .25s cubic-bezier(.22,.61,.36,1)' }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>

        {/* Header — clean white */}
        <div className="relative px-4 pt-5 pb-5 bg-white border-b border-gray-100 shrink-0">
          {/* Close button (absolute) */}
          {!profileForceChange && (
            <button
              onClick={closeProfile}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          )}

          {/* Centered avatar + name + role */}
          <div className="relative flex flex-col items-center text-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center ring-4 ring-accent/5">
                <span className="text-accent font-black text-2xl">{initials}</span>
              </div>
              {u?.is_active && (
                <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center ring-2 ring-white shadow">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              )}
            </div>
            <p className="mt-2.5 text-sm font-bold leading-tight truncate max-w-full text-gray-800">@{u?.username}</p>
            <span className="mt-0.5 text-[10px] font-bold text-accent uppercase tracking-wider">{role}</span>
          </div>
        </div>

        {/* Segmented tab control */}
        <div className="px-4 pt-3 pb-3 bg-white border-b border-gray-100 shrink-0">
          <div className="inline-flex w-full rounded-lg bg-gray-100 p-0.5">
            {[
              { id: 'profile',  label: 'Profile',  icon: User },
              { id: 'password', label: 'Password', icon: Lock },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => !profileForceChange && setTab(id)}
                disabled={profileForceChange && id !== 'password'}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
                  tab === id
                    ? 'bg-white text-accent shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Force banner */}
        {profileForceChange && (
          <div className="flex items-start gap-2.5 px-5 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 shrink-0">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-500" />
            <p className="text-xs font-medium">You are using a temporary password. Please change it to continue using the app.</p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50/40">
          {tab === 'profile' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                  <User size={11} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-gray-800">Account Information</h3>
                  <p className="text-[9px] text-gray-400">Contact an administrator to update these</p>
                </div>
              </div>
              {[
                { icon: AtSign,      label: 'Username', value: u?.username },
                { icon: ShieldCheck, label: 'Role',     value: role },
                { icon: Layers,      label: 'Brands',   value: brands },
                { icon: CircleDot,   label: 'Status',   value: u?.is_active ? 'Active' : 'Inactive', tone: u?.is_active ? 'green' : 'red' },
              ].map(({ icon: Icon, label, value, tone }) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={12} className="text-gray-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-gray-500">{label}</span>
                  </div>
                  <span className={`text-[12px] font-semibold truncate ${
                    tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-500' : 'text-gray-800'
                  }`}>
                    {value || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {tab === 'password' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                  <Lock size={11} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-gray-800">Change Password</h3>
                  <p className="text-[9px] text-gray-400">Use a strong, unique password</p>
                </div>
              </div>

              <form id="pw-form" onSubmit={handleChangePw} className="space-y-3.5">
                {[
                  { key: 'old_password',     label: 'Current Password',     ph: 'Enter current password' },
                  { key: 'new_password',     label: 'New Password',         ph: 'Min 8 chars, upper, lower, digit, symbol' },
                  { key: 'confirm_password', label: 'Confirm New Password', ph: 'Repeat new password' },
                ].map(({ key, label, ph }) => (
                  <div key={key}>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
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
          )}
        </div>

        {/* Footer */}
        {tab === 'profile' && !profileForceChange && (
          <div className="border-t border-gray-100 px-4 py-3 bg-white shrink-0">
            <button
              onClick={() => { logout(); closeProfile() }}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        )}

        {tab === 'password' && (
          <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/40 flex items-center justify-end gap-2 shrink-0">
            {!profileForceChange && (
              <button onClick={closeProfile} className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
            )}
            <button type="submit" form="pw-form" disabled={pwLoading} className="btn-primary">
              <Save size={14} /> {pwLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
