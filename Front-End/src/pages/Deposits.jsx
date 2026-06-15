import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, Search, SquarePen, Trash2, CheckCircle2, XCircle, Clock, Paperclip, QrCode, Wallet, Building2, Loader2, BadgeCheck, ExternalLink, FileCheck2, Eye, User, Calendar } from 'lucide-react'
import { createDeposit, deleteDeposit, getDeposits, updateDeposit, reviewDeposit, getDepositActivities } from '../api/deposits'
import { getGateways }     from '../api/master'
import { getQRCodes }      from '../api/payments'
import { getUPISources }   from '../api/payments'
import { getBankAccounts } from '../api/payments'
import Modal         from '../components/ui/Modal'
import SortableTh    from '../components/ui/SortableTh'
import { useSortable } from '../hooks/useSortable'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination    from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'
import { slipFile as vSlipFile, extractApiErrors } from '../utils/validators'

// Gateway options are fetched from master API – see useGateways() hook below

const CHANNEL_OPTS = [
  { value: 'qr',   label: 'QR Code',      Icon: QrCode    },
  { value: 'upi',  label: 'UPI',          Icon: Wallet    },
  { value: 'bank', label: 'Bank Account', Icon: Building2 },
]

const CHANNEL_BADGE = {
  qr:   'bg-purple-50 text-purple-700 border-purple-200',
  upi:  'bg-blue-50 text-blue-700 border-blue-200',
  bank: 'bg-teal-50 text-teal-700 border-teal-200',
}

const CHANNEL_LABEL = { qr: 'QR Code', upi: 'UPI', bank: 'Bank Account' }

// RM-side status options (shown in Create / Edit forms)
const RM_STATUS_OPTS = [
  { value: 'not_received', label: 'Not Received' },
  { value: 'completed',    label: 'Completed'    },
]

// Unified "Ticket Status" derived from both slip_status + review status
const TICKET_STATUS_CONFIG = {
  not_received: { label: 'Not Received', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    Icon: XCircle     },
  pending:      { label: 'Pending',      bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  Icon: Clock       },
  in_progress:  { label: 'In Progress',  bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', Icon: Loader2     },
  added:        { label: 'Added',        bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200',   Icon: FileCheck2  },
  completed:    { label: 'Completed',    bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  Icon: BadgeCheck  },
  // legacy
  approved:     { label: 'Approved',     bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  Icon: CheckCircle2 },
  rejected:     { label: 'Rejected',     bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    Icon: XCircle     },
}

function deriveTicketStatus(r) {
  if (!r) return 'pending'
  if (r.status === 'completed') return 'completed'
  if (r.status === 'approved')  return 'approved'
  if (r.status === 'rejected')  return 'rejected'
  if (r.status === 'in_progress') return r.review_slip ? 'added' : 'in_progress'
  if (r.slip_status === 'not_received') return 'not_received'
  return 'pending'
}

// Back Office review options
const REVIEW_DECISION_OPTS = [
  { value: 'in_progress', label: 'In Progress', hint: 'Reviewing — no receipt yet'   },
  { value: 'added',       label: 'Added',       hint: 'Receipt uploaded, confirming' },
  { value: 'completed',   label: 'Completed',   hint: 'Fully verified and done'      },
]

// ── Shared hook: fetches active gateways from master module ─────────────
function useGateways() {
  const { data } = useQuery({
    queryKey: ['master-gateways'],
    queryFn:  getGateways,
    staleTime: 5 * 60 * 1000,
  })
  return data?.data?.data ?? []
}

// ── Shared hook: fetches all channel options for a given channel_type ─────
function useChannelOptions(channelType) {
  const { data: qrData }   = useQuery({ queryKey: ['qr-all'],   queryFn: () => getQRCodes({ page_size: 200 }),   enabled: channelType === 'qr'   })
  const { data: upiData }  = useQuery({ queryKey: ['upi-all'],  queryFn: () => getUPISources({ page_size: 200 }),  enabled: channelType === 'upi'  })
  const { data: bankData } = useQuery({ queryKey: ['bank-all'], queryFn: () => getBankAccounts({ page_size: 200 }), enabled: channelType === 'bank' })

  if (channelType === 'qr')
    return (qrData?.data?.data?.results ?? []).map((c) => ({ id: c.id, label: c.qr_name }))
  if (channelType === 'upi')
    return (upiData?.data?.data?.results ?? []).map((c) => ({ id: c.id, label: c.upi_id }))
  if (channelType === 'bank')
    return (bankData?.data?.data?.results ?? []).map((c) => ({ id: c.id, label: `${c.bank_name} – ${c.account_number}` }))
  return []
}

// ── Channel Type + Channel selector (shared between Create & Edit) ─────────
function ChannelSelector({ channelType, channelId, onTypeChange, onIdChange }) {
  const options = useChannelOptions(channelType)

  return (
    <div className="space-y-3">
      {/* Channel Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Channel</label>
        <div className="grid grid-cols-3 gap-2">
          {CHANNEL_OPTS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onTypeChange(value)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                channelType === value
                  ? 'border-accent bg-accent/10 text-accent-dark'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Item — only when type is selected */}
      {channelType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Select {CHANNEL_LABEL[channelType]}
          </label>
          <select
            className="input"
            value={channelId}
            onChange={(e) => onIdChange(e.target.value)}
          >
            <option value="">Choose {CHANNEL_LABEL[channelType]}…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {options.length === 0 && (
            <p className="mt-1 text-[11px] text-gray-400">No {CHANNEL_LABEL[channelType]} records found.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Create / Log Deposit Form ──────────────────────────────────────────────
function CreateForm({ onSubmit, loading, error, apiErrors = {} }) {
  const gateways = useGateways()
  const [form, setForm] = useState({
    gateway: '',
    channel_type: '',
    channel_id:   '',
    slip:         null,
    rm_status:    'not_received',
    ark_id:       '',
    comment:      '',
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); if (local[k]) setLocal((p) => ({ ...p, [k]: undefined })) }

  const validate = () => {
    const errs = {}
    if (form.channel_type && !form.channel_id) errs.channel_id = 'Please select a channel item.'
    if (!form.ark_id) errs.ark_id = 'ARK ID is required.'
    if (form.ark_id && !/^\d+$/.test(form.ark_id)) errs.ark_id = 'ARK ID must contain only integers.'
    if (form.slip) {
      const e = vSlipFile(form.slip)
      if (e) errs.slip = e
    }
    if (form.rm_status === 'completed' && !form.slip) errs.slip = 'Slip is required when status is completed.'
    if (form.ark_id && form.ark_id.length > 100) errs.ark_id = 'ARK ID must be at most 100 characters.'
    if (form.comment && form.comment.length > 2000) errs.comment = 'Comment must be at most 2000 characters.'
    setLocal(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const fd = new FormData()
    if (form.gateway) fd.append('gateway', form.gateway)
    if (form.channel_type) fd.append('channel_type', form.channel_type)
    if (form.channel_id) {
      const fkKey = form.channel_type === 'qr' ? 'qr_code'
                  : form.channel_type === 'upi' ? 'upi_source'
                  : 'bank_account'
      fd.append(fkKey, form.channel_id)
    }
    if (form.rm_status === 'completed') {
      fd.append('slip_status', 'added')
      fd.append('status',      'completed')
    } else {
      fd.append('slip_status', 'not_received')
    }
    fd.append('ark_id',      form.ark_id)
    fd.append('comment',     form.comment)
    if (form.slip) fd.append('slip', form.slip)
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Channel Type + Channel Item */}
      <ChannelSelector
        channelType={form.channel_type}
        channelId={form.channel_id}
        onTypeChange={(v) => { setForm((p) => ({ ...p, channel_type: v, channel_id: '' })); if (local.channel_type) setLocal((p) => ({ ...p, channel_type: undefined })); if (local.channel_id) setLocal((p) => ({ ...p, channel_id: undefined })) }}
        onIdChange={f('channel_id')}
      />
      {errors.channel_id && <p className="text-xs text-red-600 -mt-3">{errors.channel_id}</p>}

      {/* ARK ID + Gateway — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">ARK ID <span className="text-red-500">*</span></label>
          <input
            className={`input ${errors.ark_id ? 'border-red-300' : ''}`}
            placeholder="Enter ARK ID"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={100}
            value={form.ark_id}
            onChange={(e) => f('ark_id')(e.target.value.replace(/\D/g, ''))}
          />
          {errors.ark_id && <p className="mt-1 text-xs text-red-600">{errors.ark_id}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Gateway Name</label>
          <select
            className={`input ${errors.gateway ? 'border-red-300' : ''}`}
            value={form.gateway}
            onChange={(e) => f('gateway')(e.target.value)}
          >
            <option value="">Select gateway…</option>
            {gateways.map((gw) => (
              <option key={gw.id} value={gw.id}>{gw.name}</option>
            ))}
          </select>
          {errors.gateway && <p className="mt-1 text-xs text-red-600">{errors.gateway}</p>}
        </div>
      </div>

      {/* Slip + Status — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Slip{form.rm_status === 'completed' && <span className="text-red-500"> *</span>}</label>
          <label className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-3 py-2.5 transition-colors h-[42px] ${errors.slip ? 'border-red-300' : 'border-gray-300 hover:border-accent'}`}>
            <Paperclip size={14} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 truncate">
              {form.slip ? form.slip.name : 'Attach slip (image / PDF)'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => f('slip')(e.target.files?.[0] ?? null)}
            />
          </label>
          {errors.slip && <p className="mt-1 text-xs text-red-600">{errors.slip}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Status <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {RM_STATUS_OPTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => f('rm_status')(value)}
                className={`py-2.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                  form.rm_status === value
                    ? 'border-accent bg-accent/10 text-accent-dark'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
        <textarea
          className={`input resize-none ${errors.comment ? 'border-red-300' : ''}`}
          rows={2}
          placeholder="Optional comment…"
          maxLength={2000}
          value={form.comment}
          onChange={(e) => f('comment')(e.target.value)}
        />
        {errors.comment && <p className="mt-1 text-xs text-red-600">{errors.comment}</p>}
      </div>

      {(error || errors.non_field) && <p className="text-red-500 text-sm">{errors.non_field || error}</p>}
      <button
        type="submit"
        disabled={loading || (form.channel_type && !form.channel_id)}
        className="btn-primary w-full justify-center"
      >
        {loading ? 'Logging…' : 'Log Deposit'}
      </button>
    </form>
  )
}

// ── Review Form (back office / admin) ──────────────────────────────────────
function ReviewForm({ initial, onSubmit, loading, error, apiErrors = {} }) {
  const { user, hasPermission } = useAuthStore()
  const canComplete = hasPermission('deposits', 'complete')
  const options = canComplete
    ? REVIEW_DECISION_OPTS
    : REVIEW_DECISION_OPTS.filter((o) => o.value !== 'completed')
  const [decision,    setDecision]    = useState('in_progress')
  const [message,     setMessage]     = useState('')
  const [reviewSlip,  setReviewSlip]  = useState(null)
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }

  const validate = () => {
    const errs = {}
    if (reviewSlip) {
      const e = vSlipFile(reviewSlip)
      if (e) errs.review_slip = e
    }
    if (message && message.length > 2000) errs.message = 'Message must be at most 2000 characters.'
    setLocal(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const fd = new FormData()
    fd.append('action',  decision)
    fd.append('message', message)
    if (reviewSlip) fd.append('review_slip', reviewSlip)
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Deposit summary */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-500">Gateway</span>
          <span className="font-semibold text-gray-800">{initial?.gateway_detail?.name ?? initial?.gateway}</span>
        </div>
        {initial?.channel_type && (
          <div className="flex justify-between">
            <span className="text-gray-500">Channel</span>
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${CHANNEL_BADGE[initial.channel_type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {CHANNEL_LABEL[initial.channel_type]}
              </span>
              {initial?.channel_label && (
                <span className="text-xs text-gray-600">{initial.channel_label}</span>
              )}
            </div>
          </div>
        )}
        {(() => {
          const key  = deriveTicketStatus(initial)
          const cfg  = TICKET_STATUS_CONFIG[key] ?? TICKET_STATUS_CONFIG.pending
          const Icon = cfg.Icon
          return (
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Ticket Status</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                <Icon size={10} /> {cfg.label}
              </span>
            </div>
          )
        })()}
        {/* RM's uploaded receipt */}
        {initial?.slip && (
          <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
            <span className="text-gray-500">Receipt (by RM)</span>
            <a
              href={initial.slip}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent font-medium hover:underline"
            >
              <ExternalLink size={12} /> View Slip
            </a>
          </div>
        )}
        {initial?.comment && (
          <div className="pt-1.5 border-t border-gray-200">
            <p className="text-gray-400 text-xs mb-0.5">Comment</p>
            <p className="text-gray-700">{initial.comment}</p>
          </div>
        )}
      </div>

      {/* Decision dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Decision *</label>
        <select
          className="input"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          required
        >
          {options.map(({ value, label, hint }) => (
            <option key={value} value={value}>{label} — {hint}</option>
          ))}
        </select>
        {decision === 'added' && !reviewSlip && !initial?.review_slip && (
          <p className="mt-1 text-[11px] text-amber-600">Please attach a receipt to mark as Added.</p>
        )}
      </div>

      {/* Back-office receipt upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Upload Receipt</label>
        <label className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-4 py-3 transition-colors ${errors.review_slip ? 'border-red-300' : 'border-gray-300 hover:border-accent'}`}>
          <Paperclip size={15} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-500 truncate">
            {reviewSlip ? reviewSlip.name : (initial?.review_slip ? 'Replace existing receipt…' : 'Attach receipt (image / PDF, max 8 MB)')}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,.pdf,application/pdf"
            className="hidden"
            onChange={(e) => { setReviewSlip(e.target.files?.[0] ?? null); if (local.review_slip) setLocal((p) => ({ ...p, review_slip: undefined })) }}
          />
        </label>
        {errors.review_slip && <p className="mt-1 text-xs text-red-600">{errors.review_slip}</p>}
        {initial?.review_slip && !reviewSlip && (
          <a
            href={initial.review_slip}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <ExternalLink size={11} /> View existing receipt
          </a>
        )}
      </div>

      {/* Message to RM */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Message to RM</label>
        <textarea
          className={`input resize-none ${errors.message ? 'border-red-300' : ''}`}
          rows={3}
          placeholder="e.g. Payment confirmed, processing…"
          maxLength={2000}
          value={message}
          onChange={(e) => { setMessage(e.target.value); if (local.message) setLocal((p) => ({ ...p, message: undefined })) }}
        />
        {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
      </div>

      {(error || errors.non_field) && <p className="text-red-500 text-sm">{errors.non_field || error}</p>}
      <button
        type="submit"
        disabled={loading || (decision === 'added' && !reviewSlip && !initial?.review_slip)}
        className="btn-primary w-full justify-center mt-1"
      >
        {loading ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  )
}
// ── Edit Form ──────────────────────────────────────────────────────────────
function EditForm({ initial, onSubmit, loading, error, apiErrors = {} }) {
  const gateways = useGateways()
  // Resolve the initial channel_id from the correct FK field
  const initChannelId = initial?.channel_type === 'qr'   ? String(initial?.qr_code   ?? '')
                      : initial?.channel_type === 'upi'  ? String(initial?.upi_source  ?? '')
                      : initial?.channel_type === 'bank' ? String(initial?.bank_account ?? '')
                      : ''

  const [form, setForm] = useState({
    gateway:      String(initial?.gateway ?? ''),
    channel_type: initial?.channel_type ?? '',
    channel_id:   initChannelId,
    ark_id:       initial?.ark_id ?? '',
    comment:      initial?.comment      ?? '',
    slip:         null,
    rm_status:    initial?.status === 'completed' ? 'completed' : 'not_received',
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); if (local[k]) setLocal((p) => ({ ...p, [k]: undefined })) }

  const validate = () => {
    const errs = {}
    if (form.channel_type && !form.channel_id) errs.channel_id = 'Please select a channel item.'
    if (!form.ark_id) errs.ark_id = 'ARK ID is required.'
    if (form.ark_id && !/^\d+$/.test(form.ark_id)) errs.ark_id = 'ARK ID must contain only integers.'
    if (form.slip) {
      const e = vSlipFile(form.slip)
      if (e) errs.slip = e
    }
    if (form.rm_status === 'completed' && !form.slip && !initial?.slip) {
      errs.slip = 'Slip is required when status is completed.'
    }
    if (form.ark_id && form.ark_id.length > 100) errs.ark_id = 'ARK ID must be at most 100 characters.'
    if (form.comment && form.comment.length > 2000) errs.comment = 'Comment must be at most 2000 characters.'
    setLocal(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const fd = new FormData()
    if (form.gateway) fd.append('gateway', form.gateway)
    fd.append('channel_type', form.channel_type ?? '')
    if (form.channel_type && form.channel_id) {
      const fkKey = form.channel_type === 'qr' ? 'qr_code'
                  : form.channel_type === 'upi' ? 'upi_source'
                  : 'bank_account'
      fd.append(fkKey, form.channel_id)
    }
    if (form.rm_status === 'completed') {
      fd.append('slip_status', 'added')
      fd.append('status',      'completed')
    } else {
      fd.append('slip_status', 'not_received')
      fd.append('status',      'pending')
    }
    fd.append('ark_id',      form.ark_id)
    fd.append('comment',     form.comment)
    if (form.slip) fd.append('slip', form.slip)
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Channel Type + Channel Item */}
      <ChannelSelector
        channelType={form.channel_type}
        channelId={form.channel_id}
        onTypeChange={(v) => { setForm((p) => ({ ...p, channel_type: v, channel_id: '' })); if (local.channel_id) setLocal((p) => ({ ...p, channel_id: undefined })) }}
        onIdChange={f('channel_id')}
      />
      {errors.channel_id && <p className="text-xs text-red-600 -mt-3">{errors.channel_id}</p>}

      {/* ARK ID + Gateway — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">ARK ID <span className="text-red-500">*</span></label>
          <input
            className={`input ${errors.ark_id ? 'border-red-300' : ''}`}
            placeholder="Enter ARK ID"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={100}
            value={form.ark_id}
            onChange={(e) => f('ark_id')(e.target.value.replace(/\D/g, ''))}
          />
          {errors.ark_id && <p className="mt-1 text-xs text-red-600">{errors.ark_id}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Gateway Name</label>
          <select
            className={`input ${errors.gateway ? 'border-red-300' : ''}`}
            value={form.gateway}
            onChange={(e) => f('gateway')(e.target.value)}
          >
            <option value="">Select gateway…</option>
            {gateways.map((gw) => (
              <option key={gw.id} value={gw.id}>{gw.name}</option>
            ))}
          </select>
          {errors.gateway && <p className="mt-1 text-xs text-red-600">{errors.gateway}</p>}
        </div>
      </div>

      {/* Slip + Status — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Slip</label>
          <label className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-3 py-2.5 transition-colors h-[42px] ${errors.slip ? 'border-red-300' : 'border-gray-300 hover:border-accent'}`}>
            <Paperclip size={14} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 truncate">
              {form.slip ? form.slip.name : (initial?.slip ? 'Replace existing slip…' : 'Attach slip (image / PDF)')}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => f('slip')(e.target.files?.[0] ?? null)}
            />
          </label>
          {errors.slip && <p className="mt-1 text-xs text-red-600">{errors.slip}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Status <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {RM_STATUS_OPTS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => f('rm_status')(value)}
                className={`py-2.5 rounded-lg border-2 text-xs font-semibold transition-all ${
                  form.rm_status === value
                    ? 'border-accent bg-accent/10 text-accent-dark'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
        <textarea
          className={`input resize-none ${errors.comment ? 'border-red-300' : ''}`}
          rows={2}
          placeholder="Optional comment…"
          maxLength={2000}
          value={form.comment}
          onChange={(e) => f('comment')(e.target.value)}
        />
        {errors.comment && <p className="mt-1 text-xs text-red-600">{errors.comment}</p>}
      </div>

      {(error || errors.non_field) && <p className="text-red-500 text-sm">{errors.non_field || error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}

// ── Deposit Timeline (View modal content) ──────────────────────────────────
function DepositTimeline({ deposit }) {
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
        {deposit.ark_id && (
          <div className="flex justify-between">
            <span className="text-gray-500">ARK ID</span>
            <span className="font-mono text-gray-800">{deposit.ark_id}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Submitted by</span>
          <span className="text-gray-800">{deposit.submitted_by_name ?? '—'}</span>
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
          {/* Vertical line */}
          {activities.length > 1 && (
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />
          )}
          {activities.map((a) => {
            const cfg = ACTION_ICON[a.action] ?? ACTION_ICON.status_change
            const Icon = cfg.Icon
            return (
              <div key={a.id} className="relative flex gap-3">
                {/* Dot / icon */}
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ${cfg.bg}`}>
                  <Icon size={11} className={cfg.text} />
                </div>
                {/* Content */}
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Deposits() {
  const qc   = useQueryClient()
  const { user, hasPermission } = useAuthStore()
  const canCreate = hasPermission('deposits', 'create')
  const canEdit   = hasPermission('deposits', 'edit')
  const canDelete = hasPermission('deposits', 'delete')
  const canActivate = hasPermission('deposits', 'activate')
  const canReview = hasPermission('deposits', 'review')
  const canWrite  = canCreate || canEdit || canDelete
  const isRM      = canCreate && !canReview

  const gateways = useGateways()

  const [page,            setPage]            = useState(1)
  const [pageSize,        setPageSize]        = useState(25)
  const [search,          setSearch]          = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [gatewayFilter,   setGatewayFilter]   = useState('')
  const [channelFilter,   setChannelFilter]   = useState('')
  const [modal,           setModal]           = useState(null)
  const [delTarget,       setDelTarget]       = useState(null)
  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  // Debounce search — wait 400ms after last keystroke before firing API
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['deposits', page, pageSize, debouncedSearch, gatewayFilter, channelFilter],
    queryFn:  () => getDeposits({ page, page_size: pageSize, search: debouncedSearch || undefined, gateway: gatewayFilter || undefined, channel_type: channelFilter || undefined }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1

  const getDepositVal = (row, key) => {
    if (key === 'gateway')       return (row.gateway_detail?.name ?? '').toLowerCase()
    if (key === 'channel')       return (CHANNEL_LABEL[row.channel_type] ?? '').toLowerCase()
    if (key === 'channel_detail') return (row.channel_label ?? '').toLowerCase()
    if (key === 'ark_id')        return Number(row.ark_id || 0)
    if (key === 'slip')          return row.slip ? 1 : 0
    if (key === 'comment')       return (row.comment ?? '').toLowerCase()
    if (key === 'logged_by')     return (row.submitted_by_name ?? '').toLowerCase()
    if (key === 'created_at')    return row.created_at ? new Date(row.created_at).getTime() : 0
    if (key === 'ticket_status') return (TICKET_STATUS_CONFIG[deriveTicketStatus(row)]?.label ?? '').toLowerCase()
    return ''
  }

  const { sorted: sortedRecords, toggle: toggleSort, icon: sortIcon } =
    useSortable(records, getDepositVal, 'created_at', 'desc')

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
        {canCreate && (
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus size={16} /> Log Deposit
          </button>
        )}
      </div>

      {/* Filters + Pagination */}
      <div className="card py-4 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-[320px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search gateway, channel, ARK ID…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input max-w-[160px]" value={gatewayFilter}
            onChange={(e) => { setGatewayFilter(e.target.value); setPage(1) }}>
            <option value="">All gateways</option>
            {gateways.map((gw) => (
              <option key={gw.id} value={gw.id}>{gw.name}</option>
            ))}
          </select>
          <select className="input max-w-[160px]" value={channelFilter ?? ''}
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
              <SortableTh label="ARK ID"          sortKey="ark_id"         toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Slip"            sortKey="slip"           toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Comment"         sortKey="comment"        toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Logged By"       sortKey="logged_by"      toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Created At"      sortKey="created_at"     toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Ticket Status"   sortKey="ticket_status"  toggle={toggleSort} icon={sortIcon} />
              {(canWrite || canReview) && (
                <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.length === 0 && (
              <tr><td colSpan={canWrite || canReview ? 10 : 9} className="px-4 py-10 text-center text-gray-400 text-sm">
                {canCreate ? 'No deposits logged yet. Use "Log Deposit" to record a deposit.' : 'No deposit logs found.'}
              </td></tr>
            )}
            {sortedRecords.map((r) => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                {/* Gateway */}
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-accent/10 text-accent-dark border-accent/20 whitespace-nowrap">{r.gateway_detail?.name ?? '—'}</span>
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
                <td className="px-4 py-2.5 text-xs text-gray-600 text-center">{r.ark_id || '—'}</td>
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
                {/* Created At */}
                <td className="px-4 py-2.5 text-xs text-gray-500 text-center">{fmtDate(r.created_at)}</td>
                {/* Ticket Status */}
                <td className="px-4 py-2.5 text-center">
                  {(() => {
                    const key  = deriveTicketStatus(r)
                    const cfg  = TICKET_STATUS_CONFIG[key] ?? TICKET_STATUS_CONFIG.pending
                    const Icon = cfg.Icon
                    return (
                      <div className="flex flex-col items-center gap-1">
                        <span className={`inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap w-fit ${cfg.bg} ${cfg.text} ${cfg.border}`}>
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
                      {/* View timeline */}
                      <button onClick={() => setModal({ mode: 'view', data: r })}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-accent transition-colors" title="View Timeline">
                        <Eye size={12} />
                      </button>
                      {canReview && r.status !== 'completed' && (
                        <button onClick={() => setModal({ mode: 'review', data: r })}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-green-50 text-green-500 hover:bg-green-100 transition-colors" title="Review">
                          <CheckCircle2 size={12} />
                        </button>
                      )}
                      {canWrite && (
                        <>
                          <button onClick={() => setModal({ mode: 'edit', data: r })}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                            <SquarePen size={12} />
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
      </div>

      {/* View / Timeline Modal */}
      <Modal open={modal?.mode === 'view'} onClose={() => setModal(null)} title="Deposit Timeline" size="lg">
        {modal?.mode === 'view' && modal?.data && (
          <DepositTimeline deposit={modal.data} />
        )}
      </Modal>

      {/* Create Modal */}
      {canCreate && (
        <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Log Client Deposit">
          <CreateForm
            loading={createM.isPending}
            error={createM.error?.response?.data?.message || (createM.isError ? 'Failed to log deposit.' : null)}
            apiErrors={extractApiErrors(createM.error || {})}
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
          apiErrors={extractApiErrors(updateM.error || {})}
          onSubmit={(vals) => updateM.mutate({ id: modal.data.id, d: vals })}
        />
      </Modal>

      {/* Review Modal */}
      <Modal open={modal?.mode === 'review'} onClose={() => setModal(null)} title="Review Deposit">
        <ReviewForm
          initial={modal?.data}
          loading={reviewM.isPending}
          error={reviewM.error?.response?.data?.message || (reviewM.isError ? 'Failed to submit review.' : null)}
          apiErrors={extractApiErrors(reviewM.error || {})}
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
        message={`Delete this ${delTarget?.gateway_detail?.name ?? ''} deposit log? This cannot be undone.`}
      />
    </div>
  )
}
