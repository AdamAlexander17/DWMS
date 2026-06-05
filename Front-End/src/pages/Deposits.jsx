import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, QrCode, Wallet, Building2, Calendar, IndianRupee, Pencil, Trash2, Ban, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { createDeposit, deleteDeposit, getDeposits, updateDeposit, reviewDeposit } from '../api/deposits'
import { getQRCodes }      from '../api/payments'
import { getUPISources }   from '../api/payments'
import { getBankAccounts } from '../api/payments'
import Modal         from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination    from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'

const CHANNEL_OPTS = [
  { value: 'qr',   label: 'QR Code',      Icon: QrCode    },
  { value: 'upi',  label: 'UPI Source',   Icon: Wallet    },
  { value: 'bank', label: 'Bank Account', Icon: Building2 },
]

const CHANNEL_TYPE_LABEL = { qr: 'QR Code', upi: 'UPI', bank: 'Bank' }

const CHANNEL_BADGE = {
  qr:   'bg-purple-100 text-purple-700',
  upi:  'bg-blue-100 text-blue-700',
  bank: 'bg-teal-100 text-teal-700',
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: 'bg-amber-100',  text: 'text-amber-700',  Icon: Clock          },
  approved: { label: 'Approved', bg: 'bg-green-100',  text: 'text-green-700',  Icon: CheckCircle2   },
  rejected: { label: 'Rejected', bg: 'bg-red-100',    text: 'text-red-700',    Icon: XCircle        },
}

function nowLocal() {
  const now = new Date()
  now.setSeconds(0, 0)
  return now.toISOString().slice(0, 16)
}

// ── Create Form (full form with channel selector) ──────────────────────────
function CreateForm({ onSubmit, loading, error }) {
  const [form, setForm] = useState({
    channel_type: '',
    channel_id:   '',
    client_name:  '',
    amount:       '',
    utr_number:   '',
    deposit_at:   nowLocal(),
    remarks:      '',
  })
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))

  const { data: qrData }   = useQuery({ queryKey: ['qr-active'],   queryFn: () => getQRCodes({ is_active: true, page_size: 100 }),   enabled: form.channel_type === 'qr'   })
  const { data: upiData }  = useQuery({ queryKey: ['upi-active'],  queryFn: () => getUPISources({ is_active: true, page_size: 100 }),  enabled: form.channel_type === 'upi'  })
  const { data: bankData } = useQuery({ queryKey: ['bank-active'], queryFn: () => getBankAccounts({ is_active: true, page_size: 100 }), enabled: form.channel_type === 'bank' })

  const channels = {
    qr:   (qrData?.data?.data?.results   ?? []).map((c) => ({ id: c.id, label: `${c.qr_name}  (₹${c.range_from}–₹${c.range_to})`,             isBlocked: c.capacity?.capacity_status === 'exhausted', pct: c.capacity?.percent_used ?? 0, rangeFrom: Number(c.range_from), rangeTo: Number(c.range_to) })),
    upi:  (upiData?.data?.data?.results  ?? []).map((c) => ({ id: c.id, label: `${c.upi_id}  (₹${c.range_from}–₹${c.range_to})`,                   isBlocked: c.capacity?.capacity_status === 'exhausted', pct: c.capacity?.percent_used ?? 0, rangeFrom: Number(c.range_from), rangeTo: Number(c.range_to) })),
    bank: (bankData?.data?.data?.results ?? []).map((c) => ({ id: c.id, label: `${c.bank_name} – ${c.account_number}  (₹${c.range_from}–₹${c.range_to})`, isBlocked: c.capacity?.capacity_status === 'exhausted', pct: c.capacity?.percent_used ?? 0, rangeFrom: Number(c.range_from), rangeTo: Number(c.range_to) })),
  }

  const selectedChannel = form.channel_id
    ? (channels[form.channel_type] ?? []).find((c) => c.id === Number(form.channel_id))
    : null

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, channel_id: Number(form.channel_id) }) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Channel Type *</label>
        <div className="grid grid-cols-3 gap-2">
          {CHANNEL_OPTS.map(({ value, label, Icon }) => (
            <button key={value} type="button"
              onClick={() => setForm((p) => ({ ...p, channel_type: value, channel_id: '' }))}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-xs font-semibold transition-all ${form.channel_type === value ? 'border-accent bg-accent/10 text-accent-dark' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            ><Icon size={18} />{label}</button>
          ))}
        </div>
      </div>
      {form.channel_type && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Channel *</label>
          <select className="input" value={form.channel_id} onChange={(e) => f('channel_id')(e.target.value)} required>
            <option value="">Choose {CHANNEL_TYPE_LABEL[form.channel_type]}…</option>
            {(channels[form.channel_type] ?? []).map((c) => (
              <option key={c.id} value={c.id} disabled={c.isBlocked}>
                {c.isBlocked ? `🚫 BLOCKED (${c.pct}% used) – ` : ''}{c.label}
              </option>
            ))}
          </select>
          {selectedChannel?.isBlocked && (
            <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <Ban size={15} className="mt-0.5 shrink-0 text-red-500" />
              <div>
                <p className="text-sm font-semibold text-red-700">Channel Blocked</p>
                <p className="mt-0.5 text-xs text-red-500">
                  This channel has reached {selectedChannel.pct}% of its daily limit and cannot accept new deposits today.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Name *</label>
          <input className="input" placeholder="e.g. Rahul Sharma" value={form.client_name} onChange={(e) => f('client_name')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹) *</label>
          <input
            type="number"
            className="input"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => f('amount')(e.target.value)}
            step="0.01"
            min={selectedChannel?.rangeFrom ?? '0.01'}
            max={selectedChannel?.rangeTo ?? undefined}
            required
          />
          {selectedChannel && (
            <p className="mt-1 text-[11px] text-gray-400">
              Allowed: ₹{selectedChannel.rangeFrom.toLocaleString('en-IN')} – ₹{selectedChannel.rangeTo.toLocaleString('en-IN')}
            </p>
          )}
          {selectedChannel && form.amount && (
            Number(form.amount) < selectedChannel.rangeFrom
              ? <p className="mt-0.5 text-[11px] text-red-500">Amount is below the minimum of ₹{selectedChannel.rangeFrom.toLocaleString('en-IN')}.</p>
              : Number(form.amount) > selectedChannel.rangeTo
                ? <p className="mt-0.5 text-[11px] text-red-500">Amount exceeds the maximum of ₹{selectedChannel.rangeTo.toLocaleString('en-IN')}.</p>
                : null
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">UTR / Ref. No. *</label>
          <input className="input font-mono" placeholder="Transaction reference" value={form.utr_number} onChange={(e) => f('utr_number')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Deposit Date & Time *</label>
          <input type="datetime-local" className="input" value={form.deposit_at} onChange={(e) => f('deposit_at')(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
        <textarea className="input resize-none" rows={2} placeholder="Optional note…" value={form.remarks} onChange={(e) => f('remarks')(e.target.value)} />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={
        loading ||
        !form.channel_type ||
        !form.channel_id ||
        !!selectedChannel?.isBlocked ||
        (selectedChannel && form.amount && (Number(form.amount) < selectedChannel.rangeFrom || Number(form.amount) > selectedChannel.rangeTo))
      } className="btn-primary w-full justify-center mt-1">
        {loading ? 'Logging…' : 'Log Deposit'}
      </button>
    </form>
  )
}

// ── Review Form (approve / reject by back office or admin) ───────────────────────
function ReviewForm({ initial, onSubmit, loading, error }) {
  const [decision, setDecision] = useState('approved')
  const [message,  setMessage]  = useState('')

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ action: decision, message }) }} className="space-y-4">
      {/* Deposit summary */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-500">Client</span>
          <span className="font-semibold text-gray-800">{initial?.client_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Amount</span>
          <span className="font-bold text-gray-800">₹{Number(initial?.amount).toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">UTR / Ref</span>
          <span className="font-mono text-gray-600">{initial?.utr_number}</span>
        </div>
        {initial?.remarks && (
          <div className="pt-1.5 border-t border-gray-200">
            <p className="text-gray-400 text-xs mb-0.5">RM Remarks</p>
            <p className="text-gray-700">{initial.remarks}</p>
          </div>
        )}
      </div>

      {/* Approve / Reject selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Decision *</label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setDecision('approved')}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
              decision === 'approved' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}>
            <CheckCircle2 size={16} /> Approve
          </button>
          <button type="button" onClick={() => setDecision('rejected')}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
              decision === 'rejected' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}>
            <XCircle size={16} /> Reject
          </button>
        </div>
      </div>

      {/* Message to RM */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Message to RM</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder={decision === 'approved' ? 'e.g. Payment confirmed in bank statement…' : 'e.g. UTR not found, please recheck…'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors ${
          decision === 'approved' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
        }`}
      >
        {loading ? 'Submitting…' : decision === 'approved' ? 'Approve Deposit' : 'Reject Deposit'}
      </button>
    </form>
  )
}
function EditForm({ initial, onSubmit, loading, error }) {
  const [form, setForm] = useState({
    client_name: initial?.client_name ?? '',
    amount:      initial?.amount      ?? '',
    utr_number:  initial?.utr_number  ?? '',
    deposit_at:  initial?.deposit_at ? new Date(initial.deposit_at).toISOString().slice(0, 16) : nowLocal(),
    remarks:     initial?.remarks     ?? '',
  })
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      {/* Channel info – read-only */}
      <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CHANNEL_BADGE[initial?.channel_type] ?? 'bg-gray-100 text-gray-600'}`}>
          {CHANNEL_TYPE_LABEL[initial?.channel_type]}
        </span>
        <span className="text-sm text-gray-600">{initial?.channel_label}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Name *</label>
          <input className="input" value={form.client_name} onChange={(e) => f('client_name')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹) *</label>
          <input type="number" className="input" value={form.amount} onChange={(e) => f('amount')(e.target.value)} step="0.01" min="0.01" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">UTR / Ref. No. *</label>
          <input className="input font-mono" value={form.utr_number} onChange={(e) => f('utr_number')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Deposit Date & Time *</label>
          <input type="datetime-local" className="input" value={form.deposit_at} onChange={(e) => f('deposit_at')(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
        <textarea className="input resize-none" rows={2} value={form.remarks} onChange={(e) => f('remarks')(e.target.value)} />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-1">
        {loading ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Deposits() {
  const qc   = useQueryClient()
  const { user } = useAuthStore()
  const isRM      = user?.role === 'rm'
  const canWrite  = ['admin', 'rm'].includes(user?.role)
  const canReview  = ['admin', 'back_office'].includes(user?.role)

  const [page,       setPage]       = useState(1)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modal,      setModal]      = useState(null)   // null | { mode: 'create' } | { mode: 'edit', data: record }
  const [delTarget,  setDelTarget]  = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['deposits', page, search, typeFilter],
    queryFn:  () => getDeposits({ page, search, channel_type: typeFilter || undefined }),
  })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['deposits'] })
    qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    qc.invalidateQueries({ queryKey: ['qr-codes'] })
    qc.invalidateQueries({ queryKey: ['upi-sources'] })
    qc.invalidateQueries({ queryKey: ['bank-accounts'] })
  }

  const createM = useMutation({ mutationFn: createDeposit,                                  onSuccess: () => { inv(); setModal(null) } })
  const updateM = useMutation({ mutationFn: ({ id, d }) => updateDeposit(id, d),            onSuccess: () => { inv(); setModal(null) } })
  const deleteM = useMutation({ mutationFn: deleteDeposit,                                  onSuccess: () => { inv(); setDelTarget(null) } })
  const reviewM = useMutation({ mutationFn: ({ id, d }) => reviewDeposit(id, d),            onSuccess: () => { inv(); setModal(null) } })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Deposits</h1>
          <p className="page-subtitle">{total} deposit log{total !== 1 ? 's' : ''}</p>
        </div>
        {isRM && (
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus size={16} /> Log Deposit
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search client, UTR…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="input max-w-[180px]" value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}>
            <option value="">All channel types</option>
            <option value="qr">QR Code</option>
            <option value="upi">UPI</option>
            <option value="bank">Bank</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['Client', 'Channel', 'Amount', 'UTR / Ref', 'Deposit Time', 'Logged By', 'Brand', 'Status', ...(canWrite || canReview ? ['Actions'] : [])].map((h) => (
                <th key={h} className={`px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && (
              <tr><td colSpan={canWrite || canReview ? 10 : 9} className="px-6 py-12 text-center text-gray-400">
                {isRM ? 'No deposits logged yet. Use "Log Deposit" to record a client deposit.' : 'No deposit logs found.'}
              </td></tr>
            )}
            {records.map((r, i) => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-5 py-4 font-semibold text-gray-800">{r.client_name}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold w-fit ${CHANNEL_BADGE[r.channel_type] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CHANNEL_TYPE_LABEL[r.channel_type]}
                    </span>
                    <span className="text-xs text-gray-500 truncate max-w-[140px]">{r.channel_label}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1 font-bold text-gray-800">
                    <IndianRupee size={13} className="text-gray-400" />
                    {Number(r.amount).toLocaleString('en-IN')}
                  </div>
                </td>
                <td className="px-5 py-4 font-mono text-xs text-gray-600">{r.utr_number}</td>
                <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-gray-300" />
                    {new Date(r.deposit_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </td>
                <td className="px-5 py-4 text-xs text-gray-500">{r.submitted_by_name ?? '—'}</td>
                <td className="px-5 py-4">
                  <span className="bg-accent/10 text-accent-dark text-xs font-bold px-2 py-0.5 rounded-md">{r.brand_name}</span>
                </td>
                {/* Status */}
                <td className="px-5 py-4">
                  {(() => {
                    const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending
                    const Icon = cfg.Icon
                    return (
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold w-fit ${cfg.bg} ${cfg.text}`}>
                          <Icon size={10} /> {cfg.label}
                        </span>
                        {r.review_message && (
                          <span className="text-[11px] text-gray-500 max-w-[160px] truncate" title={r.review_message}>
                            {r.review_message}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </td>
                {/* Actions */}
                {(canWrite || canReview) && (
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 justify-end">
                      {canReview && r.status === 'pending' && (
                        <button onClick={() => setModal({ mode: 'review', data: r })}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Review">
                          <CheckCircle2 size={14} />
                        </button>
                      )}
                      {canWrite && (
                        <>
                          <button onClick={() => setModal({ mode: 'edit', data: r })}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDelTarget(r)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 pb-4">
          <Pagination current={page} total={totalPages} onPage={setPage} />
        </div>
      </div>

      {/* Create Modal */}
      {isRM && (
        <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Log Client Deposit">
          <CreateForm
            loading={createM.isPending}
            error={createM.error?.response?.data?.message || (createM.isError ? 'Failed to log deposit.' : null)}
            onSubmit={(vals) => createM.mutate(vals)}
          />
        </Modal>
      )}

      {/* Edit Modal */}
      <Modal open={modal?.mode === 'edit'} onClose={() => setModal(null)} title="Edit Deposit">
        <EditForm
          initial={modal?.data}
          loading={updateM.isPending}
          error={updateM.error?.response?.data?.message || (updateM.isError ? 'Failed to update deposit.' : null)}
          onSubmit={(vals) => updateM.mutate({ id: modal.data.id, d: vals })}
        />
      </Modal>

      {/* Review Modal */}
      <Modal open={modal?.mode === 'review'} onClose={() => setModal(null)} title="Review Deposit">
        <ReviewForm
          initial={modal?.data}
          loading={reviewM.isPending}
          error={reviewM.error?.response?.data?.message || (reviewM.isError ? 'Failed to submit review.' : null)}
          onSubmit={(vals) => reviewM.mutate({ id: modal.data.id, d: vals })}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending}
        title="Delete Deposit"
        message={`Delete deposit of ₹${delTarget ? Number(delTarget.amount).toLocaleString('en-IN') : ''} by "${delTarget?.client_name}"? This cannot be undone.`}
      />
    </div>
  )
}
