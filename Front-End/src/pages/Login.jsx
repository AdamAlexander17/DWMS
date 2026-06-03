import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login as apiLogin } from '../api/auth'
import { useAuthStore } from '../store/authStore'

/* Decorative bar-chart SVG (purely visual, mimics BMS chart bg) */
function ChartDecoration() {
  const bars = [40, 65, 45, 80, 55, 70, 50, 90, 60, 75, 48, 85, 62, 70, 58]
  return (
    <svg viewBox="0 0 420 180" className="w-full opacity-20 mt-auto" preserveAspectRatio="none">
      {bars.map((h, i) => (
        <rect key={i} x={i * 28 + 2} y={180 - h} width={20} height={h} rx="3" fill="#f59e0b" />
      ))}
      <polyline
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.5"
        points={bars.map((h, i) => `${i * 28 + 12},${180 - h - 10}`).join(' ')}
      />
      {bars.map((h, i) =>
        h > 75 ? (
          <polygon key={`tri-${i}`} points={`${i*28+12},${180-h-22} ${i*28+8},${180-h-12} ${i*28+16},${180-h-12}`} fill="#f59e0b" />
        ) : null
      )}
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiLogin(form)
      const { access, refresh, user } = res.data.data
      setAuth({ user, access, refresh })
      navigate('/')
    } catch (err) {
      setError(
        err.response?.data?.errors?.non_field_errors?.[0] ||
        err.response?.data?.message ||
        'Invalid username or password'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — form (white) ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-10 bg-white">
        <div className="w-full max-w-[380px]">
          <h2 className="text-[1.75rem] font-extrabold text-gray-900 leading-tight">
            Login to Your Account
          </h2>
          <p className="text-gray-500 text-sm mt-2 mb-8">
            Please enter your username and password to access your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition placeholder-gray-400"
                placeholder="admin"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 pr-16 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition placeholder-gray-400"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0d1117] hover:bg-[#161b22] text-white font-bold py-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 mt-1"
            >
              {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>
        </div>
      </div>

      {/* ── RIGHT PANEL — branding (dark) ── */}
      <div className="hidden lg:flex w-[55%] bg-[#0d1117] flex-col p-10 relative overflow-hidden">
        {/* Logo + app name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1a2030] flex items-center justify-center border border-white/10">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="10" width="3" height="8" rx="1" fill="#f59e0b"/>
              <rect x="7" y="6" width="3" height="12" rx="1" fill="#f59e0b"/>
              <rect x="12" y="2" width="3" height="16" rx="1" fill="#f59e0b"/>
              <rect x="17" y="8" width="3" height="10" rx="1" fill="#f59e0b"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-black text-lg leading-none tracking-wide">DWMS</p>
            <p className="text-gray-400 text-[10px] uppercase tracking-widest mt-0.5">Deposit Details Management</p>
          </div>
        </div>

        {/* Headline */}
        <div className="mt-14">
          <h1 className="text-white text-4xl font-black leading-tight">
            Smarter Deposit<br />Management Starts Here
          </h1>
          <p className="text-gray-400 text-sm mt-4 leading-relaxed max-w-md">
            Upload and manage QR codes, UPI IDs, and bank account details — organised by brand,
            secured by role-based access, and tracked with a full audit trail.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              'Real-time QR code & UPI management',
              'Multi-brand bank account organisation',
              'Role-based access with full audit trail',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative chart */}
        <div className="absolute bottom-0 left-0 right-0 px-10 pb-14">
          <ChartDecoration />
        </div>

        {/* Copyright */}
        <p className="absolute bottom-5 left-0 right-0 text-center text-gray-600 text-xs">
          © {new Date().getFullYear()} DWMS — Deposit Details Management System
        </p>
      </div>
    </div>
  )
}
