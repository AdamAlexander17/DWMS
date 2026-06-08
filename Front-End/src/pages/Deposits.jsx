import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, CheckCircle2, XCircle, Clock, Paperclip } from 'lucide-react'
import { createDeposit, deleteDeposit, getDeposits, updateDeposit, reviewDeposit } from '../api/deposits'
import Modal         from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination    from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'

const GATEWAY_OPTS = [
  { value: 'PG1', label: 'PG1' },
  { value: 'PG2', label: 'PG2' },
]

const SLIP_STATUS_OPTS = [
  { value: 'added',        label: 'Added'        },
  { value: 'not_received', label: 'Not Received' },
  { value: 'pending',      label: 'Pending'      },
]

const SLIP_STATUS_BADGE = {
  added:        'bg-green-100 text-green-700',
  not_received: 'bg-red-100 text-red-700',
  pending:      'bg-amber-100 text-amber-700',
}

const SLIP_STATUS_LABEL = {
  added:        'Added',
  not_received: 'Not Received',
  pending:      'Pending',
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: 'bg-amber-100',  text: 'text-amber-700',  Icon: Clock        },
  approved: { label: 'Approved', bg: 'bg-green-100',  text: 'text-green-700',  Icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-100',    text: 'text-red-700',    Icon: XCircle      },
}

// ── Create / Log Deposit Form ──────────────────────────────────────────────
function CreateForm({ onSubmit, loading, error }) {
  const [form, setForm] = useState({
    gateway_name: '',
    slip:         null,
    slip_status:  'pending',
    comment:      '',
  })
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('gateway_name', form.gateway_name)
    fd.append('slip_status',  form.slip_status)
    fd.append('comment',      form.comment)
    if (form.slip) fd.append('slip', form.slip)
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Gateway Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Gateway Name *</label>
        <select
          className="input"
          value={form.gateway_name}
          onChange={(e) => f('gateway_name')(e.target.value)}
          required
        >
          <option value="">Select gateway…</option>
          {GATEWAY_OPTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Slip upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Slip</label>
        <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-accent transition-colors">
          <Paperclip size={15} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate">
            {form.slip ? form.slip.name : 'Click to attach slip (image / PDF)'}
          </span>
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => f('slip')(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {/* Slip Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Status *</label>
        <div className="grid grid-cols-3 gap-2">
          {SLIP_STATUS_OPTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => f('slip_status')(value)}
              className={`py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                form.slip_status === value
                  ? 'border-accent bg-accent/10 text-accent-dark'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="Optional comment…"
          value={form.comment}
          onChange={(e) => f('comment')(e.target.value)}
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !form.gateway_name}
        className="btn-primary w-full justify-center mt-1"
      >
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
          <span className="text-gray-500">Gateway</span>
          <span className="font-semibold text-gray-800">{initial?.gateway_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Slip Status</span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${SLIP_STATUS_BADGE[initial?.slip_status] ?? 'bg-gray-100 text-gray-600'}`}>
            {SLIP_STATUS_LABEL[initial?.slip_status] ?? initial?.slip_status}
          </span>
        </div>
        {initial?.comment && (
          <div className="pt-1.5 border-t border-gray-200">
            <p className="text-gray-400 text-xs mb-0.5">Comment</p>
            <p className="text-gray-700">{initial.comment}</p>
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
// ── Edit Form ──────────────────────────────────────────────────────────────
function EditForm({ initial, onSubmit, loading, error }) {
  const [form, setForm] = useState({
    gateway_name: initial?.gateway_name ?? '',
    slip_status:  initial?.slip_status  ?? 'pending',
    comment:      initial?.comment      ?? '',
    slip:         null,
  })
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('gateway_name', form.gateway_name)
    fd.append('slip_status',  form.slip_status)
    fd.append('comment',      form.comment)
    if (form.slip) fd.append('slip', form.slip)
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Gateway Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Gateway Name *</label>
        <select
          className="input"
          value={form.gateway_name}
          onChange={(e) => f('gateway_name')(e.target.value)}
          required
        >
          <option value="">Select gateway…</option>
          {GATEWAY_OPTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Slip upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Slip</label>
        <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-4 py-3 hover:border-accent transition-colors">
          <Paperclip size={15} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate">
            {form.slip ? form.slip.name : (initial?.slip ? 'Replace existing slip…' : 'Click to attach slip (image / PDF)')}
          </span>
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => f('slip')(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {/* Slip Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Status *</label>
        <div className="grid grid-cols-3 gap-2">
          {SLIP_STATUS_OPTS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => f('slip_status')(value)}
              className={`py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                form.slip_status === value
                  ? 'border-accent bg-accent/10 text-accent-dark'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="Optional comment…"
          value={form.comment}
          onChange={(e) => f('comment')(e.target.value)}
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading || !form.gateway_name} className="btn-primary w-full justify-center mt-1">
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

  const [page,            setPage]            = useState(1)
  const [search,          setSearch]          = useState('')
  const [gatewayFilter,   setGatewayFilter]   = useState('')
  const [slipStatusFilter,setSlipStatusFilter]= useState('')
  const [modal,           setModal]           = useState(null)
  const [delTarget,       setDelTarget]       = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['deposits', page, search, gatewayFilter, slipStatusFilter],
    queryFn:  () => getDeposits({ page, search, gateway_name: gatewayFilter || undefined, slip_status: slipStatusFilter || undefined }),
  })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['deposits'] })
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
            <input className="input pl-9" placeholder="Search comment…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="input max-w-[160px]" value={gatewayFilter}
            onChange={(e) => { setGatewayFilter(e.target.value); setPage(1) }}>
            <option value="">All gateways</option>
            {GATEWAY_OPTS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select className="input max-w-[180px]" value={slipStatusFilter}
            onChange={(e) => { setSlipStatusFilter(e.target.value); setPage(1) }}>
            <option value="">All slip statuses</option>
            {SLIP_STATUS_OPTS.map(({ value, label }) => (
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
              {['Gateway', 'Slip', 'Slip Status', 'Comment', 'Logged By', 'Review Status', ...(canWrite || canReview ? ['Actions'] : [])].map((h) => (
                <th key={h} className={`px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && (
              <tr><td colSpan={canWrite || canReview ? 7 : 6} className="px-4 py-10 text-center text-gray-400 text-sm">
                {isRM ? 'No deposits logged yet. Use "Log Deposit" to record a deposit.' : 'No deposit logs found.'}
              </td></tr>
            )}
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                {/* Gateway */}
                <td className="px-4 py-2.5">
                  <span className="bg-accent/10 text-accent-dark text-xs font-bold px-2 py-0.5 rounded-md">{r.gateway_name}</span>
                </td>
                {/* Slip */}
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
                {/* Slip Status */}
                <td className="px-4 py-2.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${SLIP_STATUS_BADGE[r.slip_status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {SLIP_STATUS_LABEL[r.slip_status] ?? r.slip_status}
                  </span>
                </td>
                {/* Comment */}
                <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[200px]">
                  <span className="line-clamp-2">{r.comment || '—'}</span>
                </td>
                {/* Logged By */}
                <td className="px-4 py-2.5 text-xs text-gray-500">{r.submitted_by_name ?? '—'}</td>
                {/* Review Status */}
                <td className="px-4 py-2.5">
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
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      {canReview && r.status === 'pending' && (
                        <button onClick={() => setModal({ mode: 'review', data: r })}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-green-50 text-green-500 hover:bg-green-100 transition-colors" title="Review">
                          <CheckCircle2 size={12} />
                        </button>
                      )}
                      {canWrite && (
                        <>
                          <button onClick={() => setModal({ mode: 'edit', data: r })}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setDelTarget(r)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                            <Trash2 size={12} />
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
        <div className="px-5 py-3 border-t border-gray-50"><Pagination current={page} total={totalPages} onPage={setPage} />
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
        message={`Delete this ${delTarget?.gateway_name ?? ''} deposit log? This cannot be undone.`}
      />
    </div>
  )
}
