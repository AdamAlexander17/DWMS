import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Search, X, CheckCircle2, XCircle, Clock,
  Upload, IndianRupee, User, Hash, Calendar, Paperclip,
} from 'lucide-react'
import { getWithdrawals, createWithdrawal, deleteWithdrawal, reviewWithdrawal } from '../api/withdrawals'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'

// ── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  pending:  { label: 'Pending',  bg: 'bg-amber-100',  text: 'text-amber-700',  Icon: Clock        },
  approved: { label: 'Approved', bg: 'bg-green-100',  text: 'text-green-700',  Icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-100',    text: 'text-red-700',    Icon: XCircle      },
}

function StatusChip({ status }) {
  const cfg = STATUS[status] ?? STATUS.pending
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

// ── Create withdrawal form ────────────────────────────────────────────────────
function WithdrawalForm({ onSubmit, onClose, loading }) {
  const [form, setForm] = useState({
    client_arc_id: '',
    client_name: '',
    amount: '',
    withdrawal_datetime: '',
    comment: '',
    attachment: null,
  })
  const fileRef = useRef()
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target?.value ?? e }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 rounded-t-2xl bg-accent">
          <div>
            <h2 className="text-base font-bold text-white">New Withdrawal Request</h2>
            <p className="text-xs text-white/60 mt-0.5">Submit a client withdrawal request for back-office review</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors ml-4 mt-0.5">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="px-6 py-5 space-y-4">

          {/* ARC ID + Client Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                ARC ID <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" placeholder="Client ARC ID" value={form.client_arc_id}
                  onChange={f('client_arc_id')} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Client Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" placeholder="Full name" value={form.client_name}
                  onChange={f('client_name')} required />
              </div>
            </div>
          </div>

          {/* Amount + Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" type="number" min="1" step="0.01" placeholder="0.00"
                  value={form.amount} onChange={f('amount')} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Date &amp; Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8" type="datetime-local" value={form.withdrawal_datetime}
                  onChange={f('withdrawal_datetime')} required />
              </div>
            </div>
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Attachment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-accent/50 hover:bg-blue-50/20 transition-colors"
            >
              <Upload size={18} className="mx-auto text-gray-300 mb-1" />
              {form.attachment
                ? <p className="text-xs font-semibold text-accent flex items-center justify-center gap-1">
                    <Paperclip size={12} /> {form.attachment.name}
                  </p>
                : <p className="text-xs text-gray-400">Click to upload image or document</p>
              }
              <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden"
                onChange={(e) => setForm(p => ({ ...p, attachment: e.target.files[0] || null }))} />
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Comment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              className="input resize-none"
              placeholder="Add any notes or instructions for back office…"
              value={form.comment}
              onChange={f('comment')}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Review modal (Back Office / Admin) ────────────────────────────────────────
function ReviewModal({ withdrawal, onClose, onSubmit, loading }) {
  const [action, setAction]   = useState('approve')
  const [message, setMessage] = useState('')
  const fmtDt = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  return (
    <div className="space-y-4">
      {/* Request summary */}
      <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-500">Client</span>
          <span className="font-semibold text-gray-800">{withdrawal.client_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">ARC ID</span>
          <span className="font-mono text-gray-700">{withdrawal.client_arc_id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Amount</span>
          <span className="font-bold text-gray-800">₹{Number(withdrawal.amount).toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Requested for</span>
          <span className="text-gray-700">{fmtDt(withdrawal.withdrawal_datetime)}</span>
        </div>
        {withdrawal.comment && (
          <div className="pt-1.5 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-0.5">RM Note</p>
            <p className="text-xs text-gray-700">{withdrawal.comment}</p>
          </div>
        )}
        {withdrawal.attachment && (
          <div className="pt-1.5 border-t border-gray-200">
            <a href={withdrawal.attachment} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              <Paperclip size={11} /> View Attachment
            </a>
          </div>
        )}
      </div>

      {/* Action toggle */}
      <div className="flex gap-3">
        {[['approve', 'Approve', 'bg-green-500'], ['reject', 'Reject', 'bg-red-500']].map(([val, lbl, color]) => (
          <button key={val} type="button" onClick={() => setAction(val)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all border-2
              ${action === val ? `${color} text-white border-transparent` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Review message */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Message {action === 'reject' && <span className="text-red-500">*</span>}
        </label>
        <textarea rows={3} className="input resize-none"
          placeholder={action === 'approve' ? 'Optional note…' : 'Reason for rejection (required)'}
          value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>

      <div className="flex justify-end gap-3 pt-1 border-t border-gray-100">
        <button onClick={onClose}
          className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button disabled={loading} onClick={() => onSubmit({ action, review_message: message })}
          className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors
            ${action === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
          {loading ? 'Processing…' : action === 'approve' ? 'Approve' : 'Reject'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Withdrawals() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const role = user?.role

  const isRM         = role === 'rm'
  const isBackOffice = role === 'back_office'
  const canReview    = role === 'admin' || isBackOffice

  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [reviewTarget, setReview] = useState(null)
  const [delTarget, setDel]       = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['withdrawals', page, search, statusFilter],
    queryFn:  () => getWithdrawals({ page, search: search || undefined, status: statusFilter || undefined }),
  })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1

  const inv = () => qc.invalidateQueries({ queryKey: ['withdrawals'] })

  const createM = useMutation({
    mutationFn: createWithdrawal,
    onSuccess: () => { inv(); setShowForm(false) },
  })
  const reviewM = useMutation({
    mutationFn: ({ id, d }) => reviewWithdrawal(id, d),
    onSuccess: () => { inv(); setReview(null) },
  })
  const deleteM = useMutation({
    mutationFn: deleteWithdrawal,
    onSuccess: () => { inv(); setDel(null) },
  })

  const handleCreate = (form) => {
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') fd.append(k, v)
    })
    createM.mutate(fd)
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const fmtDt   = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  if (isLoading) return <PageSpinner />

  const COLS = ['Client', 'ARC ID', 'Amount', 'Date & Time', 'Attachment', 'Comment', 'Status', 'Submitted', ...(canReview ? ['Actions'] : [])]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Withdrawals</h1>
          <p className="page-subtitle">{total} request{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> New Request
        </button>
      </div>

      {/* Filters */}
      <div className="card py-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search client name, ARC ID…" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input max-w-[160px]" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
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
              <tr><td colSpan={COLS.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                {isRM ? 'No withdrawal requests yet. Use "New Request" to submit one.' : 'No withdrawal requests found.'}
              </td></tr>
            )}
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">

                {/* Client */}
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-800 text-xs">{r.client_name}</p>
                </td>

                {/* ARC ID */}
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.client_arc_id}</td>

                {/* Amount */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-0.5 font-bold text-gray-800 text-xs">
                    <IndianRupee size={11} className="text-gray-400" />
                    {Number(r.amount).toLocaleString('en-IN')}
                  </div>
                </td>

                {/* Date & Time */}
                <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Calendar size={11} className="text-gray-300 shrink-0" />
                    {fmtDt(r.withdrawal_datetime)}
                  </div>
                </td>

                {/* Attachment */}
                <td className="px-4 py-2.5">
                  {r.attachment
                    ? <a href={r.attachment} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                        <Paperclip size={11} /> View
                      </a>
                    : <span className="text-[11px] text-gray-300">—</span>
                  }
                </td>

                {/* Comment */}
                <td className="px-4 py-2.5 max-w-[160px]">
                  {r.comment
                    ? <p className="text-[11px] text-gray-500 truncate" title={r.comment}>{r.comment}</p>
                    : <span className="text-[11px] text-gray-300">—</span>
                  }
                </td>

                {/* Status */}
                <td className="px-4 py-2.5">
                  <div className="space-y-0.5">
                    <StatusChip status={r.status} />
                    {r.review_message && (
                      <p className="text-[11px] text-gray-500 max-w-[140px] truncate" title={r.review_message}>
                        {r.review_message}
                      </p>
                    )}
                  </div>
                </td>

                {/* Submitted */}
                <td className="px-4 py-2.5 text-[11px] text-gray-400 whitespace-nowrap">
                  <div className="font-medium text-gray-600">{r.submitted_by_name}</div>
                  <div className="text-gray-300">{fmtDate(r.created_at)}</div>
                </td>

                {/* Actions */}
                {canReview && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {r.status === 'pending' && (
                        <button onClick={() => setReview(r)} title="Review"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
                          <CheckCircle2 size={13} />
                        </button>
                      )}
                      {(role === 'admin' || (isRM && r.status === 'pending')) && (
                        <button onClick={() => setDel(r)} title="Delete"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
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

      {/* Create form */}
      {showForm && (
        <WithdrawalForm
          loading={createM.isPending}
          onClose={() => setShowForm(false)}
          onSubmit={handleCreate}
        />
      )}

      {/* Review modal */}
      <Modal open={!!reviewTarget} onClose={() => setReview(null)} title={`Review — ${reviewTarget?.client_name}`} size="md">
        {reviewTarget && (
          <ReviewModal
            withdrawal={reviewTarget}
            loading={reviewM.isPending}
            onClose={() => setReview(null)}
            onSubmit={(d) => reviewM.mutate({ id: reviewTarget.id, d })}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDel(null)}
        onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending}
        title="Delete Withdrawal"
        message={`Delete withdrawal request for "${delTarget?.client_name}"? This cannot be undone.`}
      />
    </div>
  )
}
