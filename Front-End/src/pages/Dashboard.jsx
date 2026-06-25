import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, Activity,
  TrendingUp, TrendingDown, Wallet, Layers,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import { getDashboardSummary } from '../api/dashboard'
import { PageSpinner } from '../components/ui/Spinner'

// ── Theme palette (matches TradeKaro yellow/black/light-gray look) ────────
const C = {
  yellow:    '#0D9488',   // teal (replaces yellow)
  yellowDk:  '#0F766E',   // dark teal
  black:     '#0F172A',
  blue:      '#1D4ED8',   // dark blue
  blueDk:    '#1E3A8A',   // deeper blue
  green:     '#15803D',   // dark green
  red:       '#EF4444',   // bright red
  amber:     '#F59E0B',
  purple:    '#8B5CF6',
  slate:     '#64748B',
  grid:      '#E2E8F0',
}

const STATUS_COLOR = {
  pending:     C.red,
  for_review:  C.purple,
  in_progress: C.blue,
  completed:   C.green,
  approved:    C.green,
  rejected:    C.red,
  slip_uploaded:          C.blue,
  bank_followup_required: C.red,
  email_sent_to_bank:     C.purple,
  closed:                 C.green,
}

const CHANNEL_COLOR = { qr: C.yellow, upi: C.blue, bank: C.purple }
const BRAND_COLORS  = [C.yellow, C.blue, C.purple, C.green, C.amber, C.red, C.yellowDk, C.slate]

// ── Helpers ───────────────────────────────────────────────────────────────
const fmtInt = (n) => Number(n ?? 0).toLocaleString('en-IN')
const fmtINR = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const PeriodPill = ({ value, label, active, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(value)}
    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
      active
        ? 'bg-accent text-white shadow-sm'
        : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
    }`}
  >
    {label}
  </button>
)

const KpiCard = ({ icon: Icon, label, value, sub, accent = 'amber', delta }) => {
  const accentMap = {
    amber:  { iconBg: 'bg-amber-50',  iconFg: 'text-amber-600',  bar: 'bg-amber-400' },
    blue:   { iconBg: 'bg-blue-100',  iconFg: 'text-blue-800',   bar: 'bg-blue-800' },
    red:    { iconBg: 'bg-red-100',   iconFg: 'text-red-800',    bar: 'bg-red-800' },
    green:  { iconBg: 'bg-green-100', iconFg: 'text-green-800',  bar: 'bg-green-800' },
    slate:  { iconBg: 'bg-slate-50',  iconFg: 'text-slate-600',  bar: 'bg-slate-400' },
  }[accent]
  const positive = typeof delta === 'number' && delta >= 0
  return (
    <div className="card relative overflow-hidden">
      <div className={`absolute top-0 left-0 h-1 w-full ${accentMap.bar}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1.5">{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentMap.iconBg} ${accentMap.iconFg}`}>
          <Icon size={18} />
        </div>
      </div>
      {typeof delta === 'number' && (
        <div className={`mt-3 inline-flex items-center gap-1 text-[11px] font-semibold ${positive ? 'text-green-800' : 'text-red-800'}`}>
          {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {positive ? '+' : ''}{delta}%
          <span className="text-gray-400 font-normal ml-1">vs previous</span>
        </div>
      )}
    </div>
  )
}

const ChartCard = ({ title, hint, right, children, height = 280 }) => (
  <div className="card">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {right}
    </div>
    <div style={{ width: '100%', height }}>{children}</div>
  </div>
)

const EmptyState = ({ msg = 'No data for this period' }) => (
  <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">
    {msg}
  </div>
)

const tipStyle = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
}

// Donut with a big bold number in the middle
function CenteredDonut({ data, total, centerLabel, dataKey = 'count', nameKey = 'label', colors }) {
  if (!data || data.length === 0) return <EmptyState />
  return (
    <div className="relative w-full h-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={2}
            dataKey={dataKey}
            nameKey={nameKey}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tipStyle} formatter={(v, n) => [fmtInt(v), n]} />
          <Legend
            iconType="circle" iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-22px]">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{centerLabel}</p>
        <p className="text-xl font-bold text-gray-900">{fmtInt(total)}</p>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod] = useState('month')

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary', period],
    queryFn:  () => getDashboardSummary(period),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const d = data?.data?.data
  const kpis            = d?.kpis              ?? {}
  const depositStatus   = d?.deposit_status    ?? []
  const withdrawStatus  = d?.withdrawal_status ?? []
  const brandDeposits   = d?.brand_deposits    ?? []
  const brandWithdrawals= d?.brand_withdrawals ?? []
  const channelMix      = d?.channel_mix       ?? []
  const ticketSplit     = d?.ticket_split      ?? []
  const trend           = d?.trend             ?? []
  const gatewayVolume   = d?.gateway_volume    ?? []

  // ── Aggregated data (removes duplicates from backend) ───────────────────
  const aggregatedDepositStatus = useMemo(() => {
    const map = new Map()
    depositStatus.forEach(item => {
      const key = item.label || item.status
      if (map.has(key)) {
        map.get(key).count += (item.count || 0)
      } else {
        map.set(key, { ...item })
      }
    })
    return Array.from(map.values())
  }, [depositStatus])

  const aggregatedWithdrawStatus = useMemo(() => {
    const map = new Map()
    withdrawStatus.forEach(item => {
      const key = item.label || item.status
      if (map.has(key)) {
        map.get(key).count += (item.count || 0)
      } else {
        map.set(key, { ...item })
      }
    })
    return Array.from(map.values())
  }, [withdrawStatus])

  const aggregatedChannelMix = useMemo(() => {
    const map = new Map()
    channelMix.forEach(item => {
      const key = item.label || item.channel
      if (map.has(key)) {
        map.get(key).count += (item.count || 0)
      } else {
        map.set(key, { ...item })
      }
    })
    return Array.from(map.values())
  }, [channelMix])

  // ── Colors now use aggregated arrays ────────────────────────────────────
  const depColors = useMemo(
    () => aggregatedDepositStatus.map((s) => STATUS_COLOR[s.status] || C.slate),
    [aggregatedDepositStatus],
  )
  const wdColors = useMemo(
    () => aggregatedWithdrawStatus.map((s) => {
      if (s.status === 'closed')  return C.blue
      if (s.status === 'pending') return '#EF4444'
      return STATUS_COLOR[s.status] || C.slate
    }),
    [aggregatedWithdrawStatus],
  )
const chanColors = useMemo(
  () => aggregatedChannelMix.map((c) => CHANNEL_COLOR[c.channel] || C.slate),
  [aggregatedChannelMix]
)

  // ── Totals use aggregated arrays ────────────────────────────────────────
  const depTotal = aggregatedDepositStatus.reduce((s, x) => s + (x.count || 0), 0)
  const wdTotal  = aggregatedWithdrawStatus.reduce((s, x) => s + (x.count || 0), 0)

  const periodHint = {
    week:  'Last 7 days',
    month: 'Last 30 days',
    year:  'Last 12 months',
  }[period]

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{periodHint} · live overview of all deposits, withdrawals and channels</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodPill value="week"  label="Weekly"  active={period === 'week'}  onClick={setPeriod} />
          <PeriodPill value="month" label="Monthly" active={period === 'month'} onClick={setPeriod} />
          <PeriodPill value="year"  label="Yearly"  active={period === 'year'}  onClick={setPeriod} />
        </div>
      </div>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={ArrowDownCircle}
          label="Total Deposits"
          value={fmtInt(kpis.deposits_count)}
          sub="logged this period"
          accent="amber"
          delta={kpis.deposits_delta_pct}
        />
        <KpiCard
          icon={ArrowUpCircle}
          label="Total Withdrawals"
          value={fmtINR(kpis.withdrawals_amount)}
          sub={`${fmtInt(kpis.withdrawals_count)} tickets`}
          accent="blue"
          delta={kpis.withdrawals_delta_pct}
        />
        <KpiCard
          icon={Clock}
          label="Pending Tickets"
          value={fmtInt(kpis.pending_tickets)}
          sub="awaiting action"
          accent="red"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Closed Tickets"
          value={fmtInt(kpis.closed_tickets)}
          sub="resolved in period"
          accent="green"
        />
        <KpiCard
          icon={Activity}
          label="Active Channels"
          value={fmtInt(kpis.active_channels)}
          sub="QR + UPI + bank"
          accent="slate"
        />
      </div>

      {/* Row: two status donuts — NOW USE AGGREGATED DATA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Deposit Status" hint="Breakdown of deposit tickets by current status" height={260}>
          <CenteredDonut data={aggregatedDepositStatus} total={depTotal} centerLabel="Deposits" colors={depColors} />
        </ChartCard>
        <ChartCard title="Withdrawal Status" hint="Breakdown of withdrawal tickets by current status" height={260}>
          <CenteredDonut data={aggregatedWithdrawStatus} total={wdTotal} centerLabel="Withdrawals" colors={wdColors} />
        </ChartCard>
      </div>

      {/* Trend chart (full width) */}
      <ChartCard
        title="Deposits vs Withdrawals — Trend"
        hint={`Volume per ${period === 'year' ? 'month' : 'day'} across the selected period`}
        height={300}
      >
        {trend.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer>
            <AreaChart data={trend} margin={{ top: 8, right: 16, left: -4, bottom: 0 }}>
              <defs>
                <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.yellow} stopOpacity={0.55} />
                  <stop offset="95%" stopColor={C.yellow} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="wdGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tipStyle} formatter={(v, n) => [fmtInt(v), n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="deposits"          name="Deposits"    stroke={C.yellow} strokeWidth={2} fill="url(#depGrad)" />
              <Area type="monotone" dataKey="withdrawals_count" name="Withdrawals" stroke={C.blue}   strokeWidth={2} fill="url(#wdGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row: brand-wise bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Brand-wise Deposits" hint="Top brands by deposit count" height={280}>
          {brandDeposits.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer>
              <BarChart data={brandDeposits} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => [fmtInt(v), 'Deposits']} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
                  {brandDeposits.map((_, i) => <Cell key={i} fill={C.yellow} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Brand-wise Withdrawals" hint="Top brands by withdrawal amount" height={280}>
          {brandWithdrawals.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer>
              <BarChart data={brandWithdrawals} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                       tickFormatter={(v) => `₹${(v/1000).toFixed(v >= 100000 ? 0 : 1)}k`} />
                <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={tipStyle} formatter={(v) => [fmtINR(v), 'Amount']} />
                <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={14}>
                  {brandWithdrawals.map((_, i) => <Cell key={i} fill={C.blue} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row: ticket split + channel mix — channel mix NOW USES AGGREGATED DATA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Pending vs Closed Tickets" hint="Overall pipeline health" height={260}>
          {ticketSplit.every((s) => !s.count) ? <EmptyState /> : (
            <CenteredDonut
              data={ticketSplit.map((s) => ({ ...s, label: s.type === 'pending' ? 'Pending' : 'Closed' }))}
              total={ticketSplit.reduce((s, x) => s + (x.count || 0), 0)}
              centerLabel="Tickets"
              dataKey="count"
              nameKey="label"
              colors={['#EF4444', C.blue]}
            />
          )}
        </ChartCard>

      {/* Payment Channel Mix */}
      <ChartCard title="Payment Channel Mix" hint="Deposits split by channel used" height={260}>
        {aggregatedChannelMix.length === 0 ? (
          <EmptyState />
        ) : (
          <CenteredDonut
            data={aggregatedChannelMix.map(item => ({
              ...item,
              label: item.label || item.channel || 'Unknown'
            }))}
            total={aggregatedChannelMix.reduce((s, x) => s + (x.count || 0), 0)}
            centerLabel="Channels"
            nameKey="label"
            colors={chanColors}
          />
        )}
      </ChartCard>
      </div>

      {/* Gateway volume bar */}
      <ChartCard
        title="Gateway-wise Deposit Volume"
        hint="How deposits are distributed across gateways"
        height={300}
        right={<Wallet size={16} className="text-gray-400" />}
      >
        {gatewayVolume.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer>
            <BarChart data={gatewayVolume} margin={{ top: 8, right: 16, left: -4, bottom: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis dataKey="gateway" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tipStyle} formatter={(v) => [fmtInt(v), 'Deposits']} />
              <Bar dataKey="deposits" radius={[6, 6, 0, 0]}>
                {gatewayVolume.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}