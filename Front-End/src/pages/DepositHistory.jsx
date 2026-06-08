import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Paperclip, QrCode, Wallet, Building2, BadgeCheck, Trash2, ExternalLink, FileCheck2 } from 'lucide-react'
import { getDeposits, deleteDeposit } from '../api/deposits'
import { getGateways } from '../api/master'
import Pagination    from '../components/ui/Pagination'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'

const CHANNEL_BADGE = {
  qr:   'bg-purple-100 text-purple-700',
  upi:  'bg-blue-100 text-blue-700',
  bank: 'bg-teal-100 text-teal-700',
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

  const deleteM = useMutation({
    mutationFn: (id) => deleteDeposit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deposit-history'] })
      setDelTarget(null)
    },
  })

  if (isLoading) return <PageSpinner />

  const cols = ['Gateway', 'Channel', 'Channel Detail', 'RM Slip', 'Comment', 'Logged By', 'Reviewed By', 'BO Receipt', ...(canDelete ? ['Actions'] : [])]

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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {cols.map((h) => (
                <th key={h} className={`px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No completed deposits yet.
                </td>
              </tr>
            )}
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-green-50/20 transition-colors">
                {/* Gateway */}
                <td className="px-4 py-2.5">
                  <span className="bg-accent/10 text-accent-dark text-xs font-bold px-2 py-0.5 rounded-md">
                    {r.gateway_detail?.name ?? '—'}
                  </span>
                </td>

                {/* Channel Type */}
                <td className="px-4 py-2.5">
                  {r.channel_type ? (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${CHANNEL_BADGE[r.channel_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CHANNEL_LABEL[r.channel_type]}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* Channel Detail */}
                <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[160px]">
                  <span className="truncate block">{r.channel_label ?? '—'}</span>
                </td>

                {/* RM Slip */}
                <td className="px-4 py-2.5">
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
                <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[200px]">
                  <span className="line-clamp-2">{r.comment || '—'}</span>
                </td>

                {/* Logged By */}
                <td className="px-4 py-2.5 text-xs text-gray-500">{r.submitted_by_name ?? '—'}</td>

                {/* Reviewed By */}
                <td className="px-4 py-2.5 text-xs text-gray-500">{r.reviewed_by_name ?? '—'}</td>

                {/* BO Receipt */}
                <td className="px-4 py-2.5">
                  {r.review_slip ? (
                    <a href={r.review_slip} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium">
                      <FileCheck2 size={11} /> View
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

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
