import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Paperclip, QrCode, Wallet, Building2, BadgeCheck, Trash2, ExternalLink, FileCheck2 } from 'lucide-react'
import { getDeposits, deleteDeposit } from '../api/deposits'
import { getGateways } from '../api/master'
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
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const isAdmin    = user?.role === 'admin'
  const isBO       = user?.role === 'back_office'
  const canDelete  = isAdmin || isBO

  const [page,          setPage]          = useState(1)
  const [search,        setSearch]        = useState('')
  const [gatewayFilter, setGatewayFilter] = useState('')
  const [channelFilter, setChannelFilter] = useState('')
  const [delTarget,     setDelTarget]     = useState(null)

  const gateways = useGateways()

  const { data, isLoading } = useQuery({
    queryKey: ['deposit-history', page, search, gatewayFilter, channelFilter],
    queryFn:  () => getDeposits({
      page,
      search,
      status:       'completed',
      gateway:      gatewayFilter || undefined,
      channel_type: channelFilter || undefined,
    }),
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

      {/* Filters */}
      <div className="card py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search comment…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
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
              <SortableTh label="BO Receipt"      sortKey="bo_receipt"     toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Created At"      sortKey="created_at"     toggle={toggleSort} icon={sortIcon} />
              {canDelete && (
                <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && (
              <tr>
                <td colSpan={9 + (canDelete ? 1 : 0)} className="px-4 py-10 text-center text-gray-400 text-sm">
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
                {canDelete && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => setDelTarget(r)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-50">
          <Pagination current={page} total={totalPages} onPage={setPage} />
        </div>
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
    </div>
  )
}
