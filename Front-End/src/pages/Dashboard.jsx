import { useQuery } from '@tanstack/react-query'
import { QrCode, Wallet, Building2, Tag, Users, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import StatCard from '../components/ui/StatCard'
import { PageSpinner } from '../components/ui/Spinner'
import { getBrands } from '../api/brands'
import { getQRCodes, getUPISources, getBankAccounts } from '../api/payments'
import { getUsers } from '../api/users'
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
    </div>
  )
}
