import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Eye, Trash2, IndianRupee, Calendar, CheckCircle2, XCircle, Clock,
  FileText, AlertTriangle, Mail, History as HistoryIcon, MessageSquare, Download,
} from 'lucide-react'
import {
  getWithdrawals, deleteWithdrawal,
} from '../api/withdrawals'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'

// Reuse status config style
const STATUS = {
  closed:   { label: 'Closed',   bg: 'bg-green-100', text: 'text-green-700', Icon: CheckCircle2 },
  approved: { label: 'Approved', bg: 'bg-green-100', text: 'text-green-700', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-100',   text: 'text-red-700',   Icon: XCircle },
}

function StatusChip({ status }) {
  const cfg = STATUS[status] ?? STATUS.closed
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

function HistoryDetailModal({ withdrawal }) {
  const fmtDt   = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        {[
          ['Client',       withdrawal.client_name],
          ['ARC ID',       withdrawal.client_arc_id],
          ['Amount',       `₹${Number(withdrawal.amount).toLocaleString('en-IN')}`],
          ['Date & Time',  fmtDt(withdrawal.withdrawal_datetime)],
          ['Submitted by', withdrawal.submitted_by_name],
          ['Submitted on', fmtDate(withdrawal.created_at)],
          ['Closed on',    fmtDate(withdrawal.updated_at)],
        ].map(([label, val]) => (
          <div key={label} className="flex justify-between items-start gap-4">
            <span className="text-gray-400 text-xs shrink-0">{label}</span>
            <span className="font-medium text-gray-800 text-xs text-right">{val}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">Final Status</span>
        <StatusChip status={withdrawal.status} />
      </div>

      {withdrawal.comment && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
          <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <MessageSquare size={11} /> RM Note
          </p>
          <p className="text-sm text-gray-700">{withdrawal.comment}</p>
        </div>
      )}

      {withdrawal.slip_url && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
          <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <FileText size={11} /> Slip
            {withdrawal.slip_uploaded_by_name && <span className="font-normal ml-1 normal-case">by {withdrawal.slip_uploaded_by_name}</span>}
          </p>
          {withdrawal.slip_note && <p className="text-sm text-gray-700 mb-2">{withdrawal.slip_note}</p>}
          <a href={withdrawal.slip_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-dark">
            <Download size={12} /> Download slip
          </a>
        </div>
      )}

      {withdrawal.followup_remarks && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
          <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-1 flex items-center gap-1">
            <AlertTriangle size={11} /> Client Did Not Receive
          </p>
          <p className="text-sm text-gray-700">{withdrawal.followup_remarks}</p>
        </div>
      )}

      {withdrawal.email_sent_at && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3">
          <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Mail size={11} /> Email Sent to Bank · {fmtDt(withdrawal.email_sent_at)}
          </p>
          {withdrawal.bank_followup_note && <p className="text-sm text-gray-700">{withdrawal.bank_followup_note}</p>}
        </div>
      )}

      {withdrawal.review_message && (
        <div className={`rounded-xl border px-4 py-3 ${withdrawal.status === 'approved' ? 'border-green-100 bg-green-50/40' : 'border-red-100 bg-red-50/40'}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${withdrawal.status === 'approved' ? 'text-green-600' : 'text-red-500'}`}>
            Back Office Review
          </p>
          <p className="text-sm text-gray-700">{withdrawal.review_message}</p>
        </div>
      )}
    </div>
  )
}

export default function WithdrawalHistory() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const role = user?.role
  const isRM = role === 'rm'

  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('')
  const [viewTarget, setView]   = useState(null)
  const [delTarget, setDel]     = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['withdrawal-history', page, search, statusF],
    queryFn:  () => getWithdrawals({
      page,
      search: search || undefined,
      history: 'true',
      status: statusF || undefined,
    }),
  })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1

  const totalAmount = records.reduce((sum, r) => sum + Number(r.amount || 0), 0)

  const deleteM = useMutation({
    mutationFn: deleteWithdrawal,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdrawal-history'] })
      qc.invalidateQueries({ queryKey: ['withdrawal-stats'] })
      setDel(null)
    },
  })

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const fmtDt   = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  if (isLoading) return <PageSpinner />

  const COLS = ['Client', 'ARC ID', 'Amount', 'Withdrawal Date', 'Status', 'Submitted By', 'Closed On', 'Actions']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <HistoryIcon size={22} className="text-accent" />
            Withdrawal History
          </h1>
          <p className="page-subtitle">
            {isRM ? 'Your resolved withdrawal tickets' : 'All resolved withdrawal tickets'} · {total} record{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card flex items-center gap-3 py-3.5 px-4 border bg-gray-50 border-gray-200">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100">
            <HistoryIcon size={18} className="text-gray-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total Records</p>
            <p className="text-2xl font-bold text-gray-700">{total}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3.5 px-4 border bg-green-50 border-green-200">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100">
            <CheckCircle2 size={18} className="text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">On This Page</p>
            <p className="text-2xl font-bold text-green-600">{records.length}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3.5 px-4 border bg-blue-50 border-blue-200">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-100">
            <IndianRupee size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount (Page)</p>
            <p className="text-2xl font-bold text-blue-600">₹{Number(totalAmount).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card py-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search client name, ARC ID…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input max-w-[200px]" value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1) }}>
          <option value="">All Statuses</option>
          <option value="closed">Closed</option>
          <option value="approved">Approved (legacy)</option>
          <option value="rejected">Rejected (legacy)</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
              {COLS.map((h) => (
                <th key={h} className={`px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && (
              <tr><td colSpan={COLS.length} className="px-4 py-12 text-center text-gray-400 text-sm">
                <HistoryIcon size={28} className="mx-auto mb-2 text-gray-300" />
                {isRM ? 'No history yet. Your closed tickets will appear here.' : 'No closed tickets in the history yet.'}
              </td></tr>
            )}
            {records.map((r) => {
              const isOwn = isRM && r.submitted_by === user?.id
              return (
                <tr key={r.id} className="transition-colors hover:bg-blue-50/20">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800 text-xs">{r.client_name}</p>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.client_arc_id}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-0.5 font-bold text-gray-800 text-xs">
                      <IndianRupee size={11} className="text-gray-400" />
                      {Number(r.amount).toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar size={11} className="text-gray-300 shrink-0" />
                      {fmtDt(r.withdrawal_datetime)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><StatusChip status={r.status} /></td>
                  <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">
                    {r.submitted_by_name}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-gray-400 whitespace-nowrap">
                    {fmtDate(r.updated_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setView(r)} title="View Details"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-accent transition-colors">
                        <Eye size={13} />
                      </button>
                      {(role === 'admin' || isOwn) && (
                        <button onClick={() => setDel(r)} title="Delete from history"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-50">
          <Pagination current={page} total={totalPages} onPage={setPage} />
        </div>
      </div>

      {/* Detail modal */}
      <Modal open={!!viewTarget} onClose={() => setView(null)} title="Closed Ticket — Full Record" size="md">
        {viewTarget && <HistoryDetailModal withdrawal={viewTarget} />}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDel(null)}
        onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending}
        title="Delete from History"
        message={`Permanently delete the closed ticket for "${delTarget?.client_name}" (₹${delTarget ? Number(delTarget.amount).toLocaleString('en-IN') : ''})? This will also delete the entire conversation. This cannot be undone.`}
      />
    </div>
  )
}
