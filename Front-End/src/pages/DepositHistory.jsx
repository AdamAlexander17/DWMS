import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Search, Paperclip, QrCode, Wallet, Building2, BadgeCheck, Trash2, ExternalLink, FileCheck2, Eye, User, Calendar, Plus, SquarePen, CheckCircle2, Clock } from 'lucide-react'
import { getDeposits, deleteDeposit, getDepositActivities } from '../api/deposits'
import { getGateways } from '../api/master'
import Modal         from '../components/ui/Modal'
import Pagination    from '../components/ui/Pagination'
import SortableTh    from '../components/ui/SortableTh'
import { useSortable } from '../hooks/useSortable'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'

const CHANNEL_BADGE = {
  qr:   'bg-purple-50 text-purple-700 border-purple-200',
  upi:  'bg-blue-50 text-blue-700 border-blue-200',
  bank: 'bg-teal-50 text-teal-700 border-teal-200',
}
const CHANNEL_LABEL = { qr: 'QR Code', upi: 'UPI', bank: 'Bank Account' }

const CHANNEL_OPTS = [
  { value: 'qr',   label: 'QR Code' },
  { value: 'upi',  label: 'UPI' },
  { value: 'bank', label: 'Bank Account' },
]

function useGateways() {
  const { data } = useQuery({
    queryKey: ['master-gateways'],
    queryFn:  getGateways,
    staleTime: 5 * 60 * 1000,
  })
  return data?.data?.data ?? []
}

export default function DepositHistory() {
  const { hasPermission } = useAuthStore()
  const qc = useQueryClient()

  const canDelete  = hasPermission('deposits', 'delete') || hasPermission('deposits', 'edit')

  const [page,          setPage]          = useState(1)
  const [pageSize,      setPageSize]      = useState(25)
  const [search,        setSearch]        = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [gatewayFilter, setGatewayFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [delTarget,     setDelTarget]     = useState(null)
  const [viewTarget,   setViewTarget]   = useState(null)

  const gateways = useGateways()

  // Debounce search — wait 400ms after last keystroke before firing API
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['deposit-history', page, pageSize, debouncedSearch, gatewayFilter, channelFilter],
    queryFn:  () => getDeposits({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      status:       'completed',
      gateway:      gatewayFilter || undefined,
      channel_type: channelFilter || undefined,
    }),
    placeholderData: keepPreviousData,
  })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const getHistVal = (row, key) => {
    if (key === 'gateway')        return (row.gateway_detail?.name ?? '').toLowerCase()
    if (key === 'channel')        return (CHANNEL_LABEL[row.channel_type] ?? '').toLowerCase()
    if (key === 'channel_detail') return (row.channel_label ?? '').toLowerCase()
    if (key === 'rm_slip')        return row.slip ? 1 : 0
    if (key === 'comment')        return (row.comment ?? '').toLowerCase()
    if (key === 'logged_by')      return (row.submitted_by_name ?? '').toLowerCase()
    if (key === 'reviewed_by')    return (row.reviewed_by_name ?? '').toLowerCase()
    if (key === 'bo_receipt')     return row.review_slip ? 1 : 0
    if (key === 'created_at')     return row.created_at ? new Date(row.created_at).getTime() : 0
    return ''
  }

  const { sorted: sortedRecords, toggle: toggleSort, icon: sortIcon } =
    useSortable(records, getHistVal, 'created_at', 'desc')

  const deleteM = useMutation({
    mutationFn: (id) => deleteDeposit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deposit-history'] })
      setDelTarget(null)
    },
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Deposit History</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} completed deposit{total !== 1 ? 's' : ''}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
          <BadgeCheck size={13} /> All Completed
        </span>
      </div>

      {/* Filters + Pagination */}
      <div className="card py-4 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-[320px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search gateway, channel, channel detail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input max-w-[160px]" value={gatewayFilter}
            onChange={(e) => { setGatewayFilter(e.target.value); setPage(1) }}>
            <option value="">All gateways</option>
            {gateways.map((gw) => (
              <option key={gw.id} value={gw.id}>{gw.name}</option>
            ))}
          </select>
          <select className="input max-w-[160px]" value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1) }}>
            <option value="">All channels</option>
            {CHANNEL_OPTS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="shrink-0">
          <Pagination current={page} total={totalPages} onPage={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(1) }} />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-center">
              <SortableTh label="Gateway"        sortKey="gateway"        toggle={toggleSort} icon={sortIcon} left />
              <SortableTh label="Channel"         sortKey="channel"        toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Channel Detail"  sortKey="channel_detail" toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="RM Slip"         sortKey="rm_slip"        toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Comment"         sortKey="comment"        toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Logged By"       sortKey="logged_by"      toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Reviewed By"     sortKey="reviewed_by"    toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Backoffice Receipt"      sortKey="bo_receipt"     toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Created At"      sortKey="created_at"     toggle={toggleSort} icon={sortIcon} />
              <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No completed deposits yet.
                </td>
              </tr>
            )}
            {sortedRecords.map((r) => (
              <tr key={r.id} className="hover:bg-green-50/20 transition-colors">
                {/* Gateway */}
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-accent/10 text-accent-dark border-accent/20 whitespace-nowrap">
                    {r.gateway_detail?.name ?? '—'}
                  </span>
                </td>

                {/* Channel Type */}
                <td className="px-4 py-2.5 text-center">
                  {r.channel_type ? (
                    <span className={`inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${CHANNEL_BADGE[r.channel_type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {CHANNEL_LABEL[r.channel_type]}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* Channel Detail */}
                <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[160px] text-center">
                  <span className="truncate block">{r.channel_label ?? '—'}</span>
                </td>

                {/* RM Slip */}
                <td className="px-4 py-2.5 text-center">
                  {r.slip ? (
                    <a href={r.slip} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                      <Paperclip size={11} /> View
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* Comment */}
                <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[200px] text-center">
                  <span className="line-clamp-2">{r.comment || '—'}</span>
                </td>

                {/* Logged By */}
                <td className="px-4 py-2.5 text-xs text-gray-500 text-center">{r.submitted_by_name ?? '—'}</td>

                {/* Reviewed By */}
                <td className="px-4 py-2.5 text-xs text-gray-500 text-center">{r.reviewed_by_name ?? '—'}</td>

                {/* BO Receipt */}
                <td className="px-4 py-2.5 text-center">
                  {r.review_slip ? (
                    <a href={r.review_slip} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium">
                      <FileCheck2 size={11} /> View
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* Created At */}
                <td className="px-4 py-2.5 text-xs text-gray-500 text-center">{fmtDate(r.created_at)}</td>

                {/* Actions */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => setViewTarget(r)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-accent transition-colors"
                      title="View Timeline"
                    >
                      <Eye size={12} />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDelTarget(r)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending}
        title="Delete Deposit Record"
        message={`Permanently delete this completed deposit (${delTarget?.gateway_detail?.name ?? ''})? This cannot be undone.`}
      />

      {/* Timeline Modal */}
      <Modal open={!!viewTarget} onClose={() => setViewTarget(null)} title="Deposit Timeline" size="lg">
        {viewTarget && <HistoryTimeline deposit={viewTarget} />}
      </Modal>
    </div>
  )
}

// ── Timeline component for Deposit History ─────────────────────────────────
function HistoryTimeline({ deposit }) {
  const { data, isLoading } = useQuery({
    queryKey: ['deposit-activities', deposit.id],
    queryFn:  () => getDepositActivities(deposit.id),
  })

  const activities = data?.data?.data ?? []

  const fmtDt = (d) => d
    ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—'

  const ACTION_ICON = {
    created:       { Icon: Plus,         bg: 'bg-green-100',  text: 'text-green-600'  },
    updated:       { Icon: SquarePen,    bg: 'bg-blue-100',   text: 'text-blue-600'   },
    reviewed:      { Icon: CheckCircle2, bg: 'bg-purple-100', text: 'text-purple-600' },
    slip_uploaded: { Icon: Paperclip,    bg: 'bg-teal-100',   text: 'text-teal-600'   },
    status_change: { Icon: Clock,        bg: 'bg-amber-100',  text: 'text-amber-600'  },
  }

  return (
    <div className="space-y-4">
      {/* Deposit summary */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Gateway</span>
          <span className="font-semibold text-gray-800">{deposit.gateway_detail?.name ?? '—'}</span>
        </div>
        {deposit.channel_type && (
          <div className="flex justify-between">
            <span className="text-gray-500">Channel</span>
            <span className="text-gray-800">{CHANNEL_LABEL[deposit.channel_type]} — {deposit.channel_label ?? ''}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Submitted by</span>
          <span className="text-gray-800">{deposit.submitted_by_name ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Reviewed by</span>
          <span className="text-gray-800">{deposit.reviewed_by_name ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Created at</span>
          <span className="text-gray-800">{fmtDt(deposit.created_at)}</span>
        </div>
        {deposit.slip && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500">RM Slip</span>
            <a href={deposit.slip} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
              <ExternalLink size={11} /> View
            </a>
          </div>
        )}
        {deposit.review_slip && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Backoffice Receipt</span>
            <a href={deposit.review_slip} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium">
              <ExternalLink size={11} /> View
            </a>
          </div>
        )}
        {deposit.comment && (
          <div className="pt-2 border-t border-gray-200">
            <p className="text-[11px] text-gray-400 mb-0.5">Comment</p>
            <p className="text-gray-700">{deposit.comment}</p>
          </div>
        )}
      </div>

      {/* Activity timeline */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity Timeline</h3>
        {isLoading && <p className="text-xs text-gray-400">Loading…</p>}
        {!isLoading && activities.length === 0 && (
          <p className="text-xs text-gray-400">No activity recorded yet.</p>
        )}
        <div className="relative pl-6 space-y-4">
          {activities.length > 1 && (
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />
          )}
          {activities.map((a) => {
            const cfg = ACTION_ICON[a.action] ?? ACTION_ICON.status_change
            const Icon = cfg.Icon
            return (
              <div key={a.id} className="relative flex gap-3">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ${cfg.bg}`}>
                  <Icon size={11} className={cfg.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 leading-relaxed">{a.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <User size={9} /> {a.actor_name ?? 'System'}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Calendar size={9} /> {fmtDt(a.created_at)}
                    </span>
                  </div>
                  {a.slip_url && (
                    <a href={a.slip_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-1">
                      <Paperclip size={10} /> View slip
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
