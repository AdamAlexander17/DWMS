import { useQuery } from '@tanstack/react-query'
import { QrCode, Wallet, Building2, Tag, Users, Activity, Clock, CheckCircle2, XCircle, TrendingUp, ArrowDownCircle, FileText, AlertTriangle, ArrowUpCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import StatCard from '../components/ui/StatCard'
import { PageSpinner } from '../components/ui/Spinner'
import { getBrands } from '../api/brands'
import { getQRCodes, getUPISources, getBankAccounts } from '../api/payments'
import { getUsers } from '../api/users'
import { getWithdrawalStats } from '../api/withdrawals'
import { useAuthStore } from '../store/authStore'

const COLORS = ['#f59e0b', '#0d1117', '#d97706', '#fde68a', '#6b7280']

export default function Dashboard() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const { data: brands,  isLoading: l1 } = useQuery({ queryKey: ['brands-summary'],  queryFn: () => getBrands({ page_size: 1 }) })
  const { data: qr,      isLoading: l2 } = useQuery({ queryKey: ['qr-summary'],      queryFn: () => getQRCodes({ page_size: 1 }) })
  const { data: upi,     isLoading: l3 } = useQuery({ queryKey: ['upi-summary'],     queryFn: () => getUPISources({ page_size: 1 }) })
  const { data: bank,    isLoading: l4 } = useQuery({ queryKey: ['bank-summary'],    queryFn: () => getBankAccounts({ page_size: 1 }) })
  const { data: users,   isLoading: l5 } = useQuery({ queryKey: ['users-summary'],   queryFn: () => getUsers({ page_size: 1 }), enabled: isAdmin })
  const { data: brandsAll               } = useQuery({ queryKey: ['brands-chart'],   queryFn: () => getBrands({ page_size: 100 }) })
  const { data: wStats                  } = useQuery({ queryKey: ['withdrawal-stats'], queryFn: getWithdrawalStats, staleTime: 30_000 })

  if (l1 || l2 || l3 || l4 || (isAdmin && l5)) return <PageSpinner />

  const totalBrands = brands?.data?.data?.count ?? 0
  const totalQR     = qr?.data?.data?.count     ?? 0
  const totalUPI    = upi?.data?.data?.count    ?? 0
  const totalBank   = bank?.data?.data?.count   ?? 0
  const totalUsers  = users?.data?.data?.count  ?? 0

  const brandsData = (brandsAll?.data?.data?.results ?? []).map((b) => ({
    name: b.name,
    active: b.is_active ? 1 : 0,
  }))

  const ws       = wStats?.data?.data
  const wCounts  = ws?.counts  ?? {}
  const wAmounts = ws?.amounts ?? {}
  const wMonthly = ws?.monthly ?? []
  const wTotal   = (wCounts.pending ?? 0) + (wCounts.slip_uploaded ?? 0) + (wCounts.bank_followup_required ?? 0) + (wCounts.email_sent_to_bank ?? 0) + (wCounts.closed ?? 0)
  const followupCount = wCounts.bank_followup_required ?? 0

  const withdrawalCards = [
    { key: 'pending',                label: 'Pending',            icon: Clock,         bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-600' },
    { key: 'slip_uploaded',          label: 'Slip Uploaded',      icon: FileText,      bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-600' },
    { key: 'bank_followup_required', label: 'Follow-Up Required', icon: AlertTriangle, bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-500' },
    { key: 'closed',                 label: 'Closed',             icon: CheckCircle2,  bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-600' },
  ]

  const chartData = [
    { label: 'QR Codes',     count: totalQR,   fill: '#f59e0b' },
    { label: 'UPI Sources',  count: totalUPI,  fill: '#0d1117' },
    { label: 'Bank Accounts',count: totalBank, fill: '#d97706' },
  ]

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.username}</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 shadow-card">
          <Activity size={13} className="text-accent" />
          Live
        </div>
      </div>

      {/* Stat cards */}
      <div className={`grid gap-4 ${isAdmin ? 'grid-cols-2 xl:grid-cols-5' : 'grid-cols-2 xl:grid-cols-4'}`}>
        {isAdmin && <StatCard label="Total Users"   value={totalUsers}  icon={Users}    color="purple" />}
        <StatCard label="Active Brands"   value={totalBrands} icon={Tag}      color="amber"  />
        <StatCard label="QR Codes"        value={totalQR}     icon={QrCode}   color="blue"   />
        <StatCard label="UPI Sources"     value={totalUPI}    icon={Wallet}   color="green"  />
        <StatCard label="Bank Accounts"   value={totalBank}   icon={Building2} color="rose"  />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Payment sources bar chart */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 text-sm mb-1">Payment Sources Overview</h3>
          <p className="text-gray-400 text-xs mb-5">Total records per source type</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,.12)', fontSize: 12 }}
                cursor={{ fill: 'rgba(245,158,11,0.06)' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Brands list */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 text-sm mb-1">Brands</h3>
          <p className="text-gray-400 text-xs mb-5">Registered brand status</p>
          {brandsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <Tag size={32} className="opacity-30" />
              <p className="text-sm">No brands yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(brandsAll?.data?.data?.results ?? []).map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-amber-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent text-sidebar-bg flex items-center justify-center font-bold text-sm">
                      {b.name.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-800 text-sm">{b.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {b.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* ── Withdrawal Overview ─────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Section heading */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <ArrowDownCircle size={14} className="text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-800">Withdrawal Overview</h2>
            <p className="text-[11px] text-gray-400">{wTotal} total request{wTotal !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Bank follow-up alert */}
        {followupCount > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="w-9 h-9 rounded-lg bg-red-500 flex items-center justify-center animate-pulse">
              <AlertTriangle size={16} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-700">{followupCount} ticket{followupCount > 1 ? 's' : ''} awaiting bank follow-up</p>
              <p className="text-[11px] text-red-600">Client(s) have not received their withdrawal amount. Please email the bank.</p>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {withdrawalCards.map(({ key, label, icon: Icon, bg, border, text }) => (
            <div key={key} className={`card flex items-center gap-4 py-4 px-5 border ${bg} ${border}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                <Icon size={18} className={text} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                <p className={`text-2xl font-bold ${text}`}>{wCounts[key]}</p>
                <p className="text-[11px] text-gray-400 truncate">
                  ₹{Number(wAmounts[key]).toLocaleString('en-IN')} total
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Monthly trend chart */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-accent" />
            <h3 className="text-sm font-semibold text-gray-700">Monthly Withdrawal Trend</h3>
          </div>
          {wMonthly.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2 text-gray-300">
              <TrendingUp size={32} className="opacity-40" />
              <p className="text-sm">No withdrawal data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={wMonthly} barSize={14} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px #0001' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="pending"                name="Pending"            fill="#f59e0b" radius={[3,3,0,0]} />
                <Bar dataKey="slip_uploaded"          name="Slip Uploaded"      fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="bank_followup_required" name="Follow-Up Required" fill="#ef4444" radius={[3,3,0,0]} />
                <Bar dataKey="closed"                 name="Closed"             fill="#22c55e" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
