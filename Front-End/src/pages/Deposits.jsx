import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, Search, SquarePen, Trash2, CheckCircle2, XCircle, Clock, Paperclip, QrCode, Wallet, Building2, Loader2, BadgeCheck, ExternalLink, FileCheck2, Eye, User, Calendar, ArrowLeftRight, MessageSquare, Send, X, Lock, Download } from 'lucide-react'
import { createDeposit, deleteDeposit, getDeposit, getDeposits, updateDeposit, reviewDeposit, getDepositActivities, getDepositMessages, postDepositMessage } from '../api/deposits'
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
import { connectWS } from '../api/ws'
import { slipFile as vSlipFile, extractApiErrors } from '../utils/validators'

// Gateway options are fetched from master API — see useGateways() hook below

// -- Download helper (works for cross-origin files like S3) -------------------
function downloadFile(url, filename) {
  fetch(url)
    .then(res => res.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename || url.split('/').pop() || 'download'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(blobUrl); a.remove() }, 100)
    })
    .catch(() => { window.open(url, '_blank') }) // fallback: open in new tab
}

// -- Notification sound (Web Audio API — no file needed) ---------------------
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [660, 880]   // E5 ? A5 (soft two-tone ping)
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.value = 0.08
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = ctx.currentTime + i * 0.12
      osc.start(start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
      osc.stop(start + 0.35)
    })
  } catch { /* browser blocked audio — silently ignore */ }
}

const CHANNEL_OPTS = [
  { value: 'qr',     label: 'QR Code',      Icon: QrCode    },
  { value: 'upi',    label: 'UPI',          Icon: Wallet    },
  { value: 'bank',   label: 'Bank Account', Icon: Building2 },
  { value: 'manual', label: 'Manual',       Icon: SquarePen },
]

const CHANNEL_BADGE = {
  qr:     'bg-purple-50 text-purple-700 border-purple-200',
  upi:    'bg-blue-50 text-blue-700 border-blue-200',
  bank:   'bg-teal-50 text-teal-700 border-teal-200',
  manual: 'bg-gray-50 text-gray-700 border-gray-200',
}

const CHANNEL_LABEL = { qr: 'QR Code', upi: 'UPI', bank: 'Bank Account', manual: 'Manual' }

// RM-side status options (shown in Create / Edit forms)
const RM_STATUS_OPTS = [
  { value: 'not_received', label: 'Not Added' },
  { value: 'completed',    label: 'Completed'    },
]

// Problem category options
const PROBLEM_CATEGORY_OPTS = [
  { value: '',                    label: 'Select category—' },
  { value: 'deposit_failed',     label: 'Deposit Failed' },
  { value: 'amount_not_received', label: 'Deposit Amount Didn\'t Receive' },
]

// Unified "Ticket Status" derived from both slip_status + review status
const TICKET_STATUS_CONFIG = {
  not_received: { label: 'Not Added', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    Icon: XCircle     },
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
  if (r.status === 'in_progress') return r.slip_status === 'added' ? 'added' : 'in_progress'
  if (r.slip_status === 'not_received') return 'not_received'
  return 'pending'
}

// Back Office review options
const REVIEW_DECISION_OPTS = [
  { value: 'in_progress', label: 'In Progress', hint: 'Reviewing — no receipt yet'   },
  { value: 'added',       label: 'Added',       hint: 'Receipt uploaded, confirming' },
  { value: 'completed',   label: 'Completed',   hint: 'Fully verified and done'      },
]

// -- Shared hook: fetches active gateways from master module -------------
function useGateways() {
  const { data } = useQuery({
    queryKey: ['master-gateways'],
    queryFn:  getGateways,
    staleTime: 5 * 60 * 1000,
  })
  return data?.data?.data ?? []
}

// -- Shared hook: fetches all channel options for a given channel_type -----
function useChannelOptions(channelType) {
  const { data: qrData }   = useQuery({ queryKey: ['qr-all'],   queryFn: () => getQRCodes({ page_size: 200 }),   enabled: channelType === 'qr'   })
  const { data: upiData }  = useQuery({ queryKey: ['upi-all'],  queryFn: () => getUPISources({ page_size: 200 }),  enabled: channelType === 'upi'  })
  const { data: bankData } = useQuery({ queryKey: ['bank-all'], queryFn: () => getBankAccounts({ page_size: 200 }), enabled: channelType === 'bank' })

  if (channelType === 'qr')
    return (qrData?.data?.data?.results ?? []).map((c) => ({ id: c.id, label: c.qr_name }))
  if (channelType === 'upi')
    return (upiData?.data?.data?.results ?? []).map((c) => ({ id: c.id, label: c.upi_id }))
  if (channelType === 'bank')
    return (bankData?.data?.data?.results ?? []).map((c) => ({ id: c.id, label: `${c.bank_name} — ${c.account_number}` }))
  return []
}

// -- Channel Type + Channel selector (shared between Create & Edit) ---------
function ChannelSelector({ channelType, channelId, onTypeChange, onIdChange }) {
  return (
    <div className="space-y-3">
      {/* Channel Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Channel</label>
        <div className="grid grid-cols-4 gap-2">
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
    </div>
  )
}

// -- Create / Log Deposit Form ----------------------------------------------
function CreateForm({ onSubmit, loading, error, apiErrors = {} }) {
  const gateways = useGateways()
  const slipInputRef = useRef(null)
  const [form, setForm] = useState({
    gateway: '',
    channel_type: '',
    channel_id:   '',
    slip:         null,
    rm_status:    'not_received',
    ark_id:       '',
    amount:       '',
    utr_number:   '',
    problem_category: '',
    comment:      '',
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); if (local[k]) setLocal((p) => ({ ...p, [k]: undefined })) }

  // Handle paste event for slip input
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    
    for (let item of items) {
      // Check if pasted item is an image or PDF
      if (item.type.startsWith('image/') || item.type === 'application/pdf') {
        const file = item.getAsFile()
        if (file) {
          f('slip')(file)
          e.preventDefault()
          break
        }
      }
    }
  }

  const validate = () => {
    const errs = {}
    // channel item removed
    if (!form.ark_id) errs.ark_id = 'ARK ID is required.'
    if (form.ark_id && !/^\d+$/.test(form.ark_id)) errs.ark_id = 'ARK ID must contain only integers.'
    if (form.slip) {
      const e = vSlipFile(form.slip)
      if (e) errs.slip = e
    }
    if (form.rm_status === 'completed' && !form.slip) {
      // Slip is optional — user can mark as completed without slip
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
    if (form.channel_type) fd.append('channel_type', form.channel_type)
    if (form.channel_id) {
      const fkKey = form.channel_type === 'qr' ? 'qr_code'
                  : form.channel_type === 'upi' ? 'upi_source'
                  : 'bank_account'
      fd.append(fkKey, form.channel_id)
    }
    if (form.rm_status === 'completed') {
      fd.append('slip_status', form.slip ? 'added' : 'not_received')
      fd.append('status',      'completed')
    } else {
      fd.append('slip_status', 'not_received')
    }
    fd.append('ark_id',      form.ark_id)
    if (form.amount) fd.append('amount', form.amount)
    if (form.utr_number) fd.append('utr_number', form.utr_number.toUpperCase())
    if (form.problem_category) fd.append('problem_category', form.problem_category)
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
            <option value="">Select gateway—</option>
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
          <div 
            className={`flex items-center gap-2 border border-dashed rounded-lg px-3 py-2.5 transition-colors h-[42px] ${errors.slip ? 'border-red-300' : 'border-gray-300 hover:border-accent'}`}
            onPaste={handlePaste}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent', 'bg-accent/5') }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('border-accent', 'bg-accent/5') }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('border-accent', 'bg-accent/5')
              const files = e.dataTransfer?.files
              if (files && files.length > 0) {
                const file = files[0]
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                  f('slip')(file)
                }
              }
            }}
          >
            <button
              type="button"
              onClick={() => slipInputRef.current?.click()}
              title="Click to select file"
              className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
            >
              <Paperclip size={14} className="text-gray-400" />
            </button>
            <span className="text-xs text-gray-500 truncate flex-1">
              {form.slip ? form.slip.name : 'Attach slip (image / PDF)'}
            </span>
            {form.slip && (
              <button
                type="button"
                onClick={() => {
                  f('slip')(null)
                  if (slipInputRef.current) slipInputRef.current.value = ''
                }}
                title="Remove file"
                className="p-1 hover:bg-red-50 rounded transition-colors shrink-0"
              >
                <X size={14} className="text-red-400 hover:text-red-600" />
              </button>
            )}
            <input
              ref={slipInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,.pdf,application/pdf"
              className="hidden"
              onChange={(e) => f('slip')(e.target.files?.[0] ?? null)}
            />
          </div>
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

      {/* Amount + UTR Number — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹)</label>
          <input
            className={`input ${errors.amount ? 'border-red-300' : ''}`}
            placeholder="Enter amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => f('amount')(e.target.value)}
          />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">UTR Number</label>
          <input
            className={`input ${errors.utr_number ? 'border-red-300' : ''}`}
            placeholder="Enter UTR number (max 22 chars)"
            maxLength={22}
            value={form.utr_number}
            onChange={(e) => f('utr_number')(e.target.value.toUpperCase())}
          />
          {errors.utr_number && <p className="mt-1 text-xs text-red-600">{errors.utr_number}</p>}
        </div>
      </div>

      {/* Problem Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Problem Category</label>
        <select
          className="input"
          value={form.problem_category}
          onChange={(e) => f('problem_category')(e.target.value)}
        >
          {PROBLEM_CATEGORY_OPTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
        <textarea
          className={`input resize-none ${errors.comment ? 'border-red-300' : ''}`}
          rows={2}
          placeholder="Optional comment—"
          maxLength={2000}
          value={form.comment}
          onChange={(e) => f('comment')(e.target.value)}
        />
        {errors.comment && <p className="mt-1 text-xs text-red-600">{errors.comment}</p>}
      </div>

      {(error || errors.non_field) && <p className="text-red-500 text-sm">{errors.non_field || error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center"
      >
        {loading ? 'Logging—' : 'Log Deposit'}
      </button>
    </form>
  )
}

// -- Review Form (back office / admin) --------------------------------------
function ReviewForm({ initial, onSubmit, loading, error, apiErrors = {} }) {
  const { user, hasPermission } = useAuthStore()
  const reviewSlipInputRef = useRef(null)
  const canComplete = hasPermission('deposits', 'complete')
  const options = canComplete
    ? REVIEW_DECISION_OPTS
    : REVIEW_DECISION_OPTS.filter((o) => o.value !== 'completed')
  const [decision,    setDecision]    = useState('in_progress')
  const [message,     setMessage]     = useState('')
  const [reviewSlip,  setReviewSlip]  = useState(null)
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }

  // Handle paste event for review slip input
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    
    for (let item of items) {
      // Check if pasted item is an image or PDF
      if (item.type.startsWith('image/') || item.type === 'application/pdf') {
        const file = item.getAsFile()
        if (file) {
          setReviewSlip(file)
          if (local.review_slip) setLocal((p) => ({ ...p, review_slip: undefined }))
          e.preventDefault()
          break
        }
      }
    }
  }

  const validate = () => {
    const errs = {}
    
    // Validate uploaded file if one is provided
    if (reviewSlip) {
      const e = vSlipFile(reviewSlip)
      if (e) errs.review_slip = e
    }
    
    // Validate message length
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
        {initial?.problem_category && (
          <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
            <span className="text-gray-500">Problem Category</span>
            <span className="text-xs font-semibold text-gray-800">
              {PROBLEM_CATEGORY_OPTS.find(o => o.value === initial.problem_category)?.label || initial.problem_category}
            </span>
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
          onChange={(e) => {
            setDecision(e.target.value)
            // Clear receipt error when switching away from 'added'
            if (local.review_slip && e.target.value !== 'added') {
              setLocal((p) => ({ ...p, review_slip: undefined }))
            }
          }}
          required
        >
          {options.map(({ value, label, hint }) => (
            <option key={value} value={value}>{label} — {hint}</option>
          ))}
        </select>
      </div>

      {/* Back-office receipt upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Upload Receipt
        </label>
        <div 
          className={`flex items-center gap-2 border border-dashed rounded-lg px-4 py-3 transition-colors ${errors.review_slip ? 'border-red-300' : 'border-gray-300 hover:border-accent'}`}
          onPaste={handlePaste}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent', 'bg-accent/5') }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('border-accent', 'bg-accent/5') }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('border-accent', 'bg-accent/5')
            const files = e.dataTransfer?.files
            if (files && files.length > 0) {
              const file = files[0]
              if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                setReviewSlip(file)
                if (local.review_slip) setLocal((p) => ({ ...p, review_slip: undefined }))
              }
            }
          }}
        >
          <button
            type="button"
            onClick={() => reviewSlipInputRef.current?.click()}
            title="Click to select file"
            className="p-1 hover:bg-gray-100 rounded transition-colors shrink-0"
          >
            <Paperclip size={15} className="text-gray-400" />
          </button>
          <span className="text-sm text-gray-500 truncate flex-1">
            {reviewSlip ? reviewSlip.name : (initial?.review_slip ? 'Replace existing receipt—' : 'Attach receipt (image / PDF, max 8 MB)')}
          </span>
          {reviewSlip && (
            <button
              type="button"
              onClick={() => {
                setReviewSlip(null)
                if (reviewSlipInputRef.current) reviewSlipInputRef.current.value = ''
                if (local.review_slip) setLocal((p) => ({ ...p, review_slip: undefined }))
              }}
              title="Remove file"
              className="p-1 hover:bg-red-50 rounded transition-colors shrink-0"
            >
              <X size={15} className="text-red-400 hover:text-red-600" />
            </button>
          )}
          <input
            ref={reviewSlipInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,.pdf,application/pdf"
            className="hidden"
            onChange={(e) => { setReviewSlip(e.target.files?.[0] ?? null); if (local.review_slip) setLocal((p) => ({ ...p, review_slip: undefined })) }}
          />
        </div>
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
          placeholder="e.g. Payment confirmed, processing—"
          maxLength={2000}
          value={message}
          onChange={(e) => { setMessage(e.target.value); if (local.message) setLocal((p) => ({ ...p, message: undefined })) }}
        />
        {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
      </div>

      {(error || errors.non_field) && <p className="text-red-500 text-sm">{errors.non_field || error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center mt-1"
      >
        {loading ? 'Submitting—' : 'Submit Review'}
      </button>
    </form>
  )
}
// -- Edit Form --------------------------------------------------------------
function EditForm({ initial, onSubmit, loading, error, apiErrors = {} }) {
  const gateways = useGateways()
  const slipInputRef = useRef(null)
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
    amount:       initial?.amount ?? '',
    utr_number:   initial?.utr_number ?? '',
    problem_category: initial?.problem_category ?? '',
    comment:      initial?.comment      ?? '',
    slip:         null,
    rm_status:    initial?.status === 'completed' ? 'completed' : 'not_received',
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); if (local[k]) setLocal((p) => ({ ...p, [k]: undefined })) }

  // Handle paste event for slip input
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    
    for (let item of items) {
      // Check if pasted item is an image or PDF
      if (item.type.startsWith('image/') || item.type === 'application/pdf') {
        const file = item.getAsFile()
        if (file) {
          f('slip')(file)
          e.preventDefault()
          break
        }
      }
    }
  }

  const validate = () => {
    const errs = {}
    // channel item removed
    if (!form.ark_id) errs.ark_id = 'ARK ID is required.'
    if (form.ark_id && !/^\d+$/.test(form.ark_id)) errs.ark_id = 'ARK ID must contain only integers.'
    if (form.slip) {
      const e = vSlipFile(form.slip)
      if (e) errs.slip = e
    }
    if (form.rm_status === 'completed' && !form.slip && !initial?.slip) {
      // Slip is optional — user can mark as completed without slip
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
      fd.append('slip_status', (form.slip || initial?.slip) ? 'added' : 'not_received')
      fd.append('status',      'completed')
    } else {
      fd.append('slip_status', 'not_received')
      fd.append('status',      'pending')
    }
    fd.append('ark_id',      form.ark_id)
    if (form.amount) fd.append('amount', form.amount)
    if (form.utr_number) fd.append('utr_number', form.utr_number.toUpperCase())
    if (form.problem_category) fd.append('problem_category', form.problem_category)
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
            <option value="">Select gateway—</option>
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
          <label className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-3 py-2.5 transition-colors h-[42px] ${errors.slip ? 'border-red-300' : 'border-gray-300 hover:border-accent'}`}
            onPaste={handlePaste}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-accent', 'bg-accent/5') }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('border-accent', 'bg-accent/5') }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('border-accent', 'bg-accent/5')
              const files = e.dataTransfer?.files
              if (files && files.length > 0) {
                const file = files[0]
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                  f('slip')(file)
                }
              }
            }}
          >
            <Paperclip size={14} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 truncate">
              {form.slip ? form.slip.name : (initial?.slip ? 'Replace existing slip—' : 'Attach slip (image / PDF)')}
            </span>
            <input
              ref={slipInputRef}
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

      {/* Problem Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Problem Category</label>
        <select
          className="input"
          value={form.problem_category}
          onChange={(e) => f('problem_category')(e.target.value)}
        >
          {PROBLEM_CATEGORY_OPTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Amount + UTR Number — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (₹)</label>
          <input
            className={`input ${errors.amount ? 'border-red-300' : ''}`}
            placeholder="Enter amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => f('amount')(e.target.value)}
          />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">UTR Number</label>
          <input
            className={`input ${errors.utr_number ? 'border-red-300' : ''}`}
            placeholder="Enter UTR number (max 22 chars)"
            maxLength={22}
            value={form.utr_number}
            onChange={(e) => f('utr_number')(e.target.value.toUpperCase())}
          />
          {errors.utr_number && <p className="mt-1 text-xs text-red-600">{errors.utr_number}</p>}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
        <textarea
          className={`input resize-none ${errors.comment ? 'border-red-300' : ''}`}
          rows={2}
          placeholder="Optional comment—"
          maxLength={2000}
          value={form.comment}
          onChange={(e) => f('comment')(e.target.value)}
        />
        {errors.comment && <p className="mt-1 text-xs text-red-600">{errors.comment}</p>}
      </div>

      {(error || errors.non_field) && <p className="text-red-500 text-sm">{errors.non_field || error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? 'Saving—' : 'Save Changes'}
      </button>
    </form>
  )
}

// -- Deposit Chat (conversation between RM and reviewers) --------------------
function DepositChat({ depositId, currentUserId }) {
  const qc = useQueryClient()
  const [text, setText]   = useState('')
  const [file, setFile]   = useState(null)
  const [composerErr, setComposerErr] = useState('')
  const [wsLive, setWsLive] = useState(false)
  const fileInputRef = useRef(null)
  const scrollerRef  = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['deposit-messages', depositId],
    queryFn:  () => getDepositMessages(depositId),
    // Fallback polling when WebSocket is disconnected
    refetchInterval: wsLive ? false : 3000,
  })
  const messages = data?.data?.data ?? []

  // Clear notification badge when chat is opened (messages fetched = marked as read on backend)
  useEffect(() => {
    if (data && !isLoading) {
      qc.invalidateQueries({ queryKey: ['notifications-list'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
      qc.invalidateQueries({ queryKey: ['deposits'] })
    }
  }, [data, isLoading, qc])

  // -- Live WebSocket subscription ----------------------------------------
  useEffect(() => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken || !depositId) return
    const conn = connectWS(`/ws/deposits/${depositId}/`, accessToken, {
      onOpen:  () => setWsLive(true),
      onClose: () => setWsLive(false),
      onMessage: (wsData) => {
        if (wsData?.type === 'message_created' && wsData.message) {
          qc.setQueryData(['deposit-messages', depositId], (prev) => {
            if (!prev) return prev
            const list = prev.data?.data ?? []
            // If this is our own message coming back from server, replace the temp optimistic one
            if (wsData.message.sender === currentUserId) {
              // Remove any temp messages and check if real message already exists
              const filtered = list.filter(m => !String(m.id).startsWith('temp-'))
              if (filtered.some(m => m.id === wsData.message.id)) return { ...prev, data: { ...prev.data, data: filtered } }
              return { ...prev, data: { ...prev.data, data: [...filtered, wsData.message] } }
            }
            // Message from someone else — just append if not duplicate
            if (list.some(m => m.id === wsData.message.id)) return prev
            return { ...prev, data: { ...prev.data, data: [...list, wsData.message] } }
          })
          // Play sound for messages from others
          if (wsData.message.sender !== currentUserId) {
            playNotifSound()
            // Auto-mark as read since chat is open — call GET to update last_read_at
            qc.invalidateQueries({ queryKey: ['deposit-messages', depositId] })
          }
        }
        // When someone reads messages, refetch to update tick marks
        if (wsData?.type === 'messages_read' && wsData.user_id !== currentUserId) {
          qc.invalidateQueries({ queryKey: ['deposit-messages', depositId] })
        }
      },
    })
    return () => conn.close()
  }, [depositId, qc, currentUserId])

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [messages.length])

  const postM = useMutation({
    mutationFn: ({ id, fd }) => postDepositMessage(id, fd),
    onMutate: async ({ optimistic }) => {
      // Optimistic: show the message instantly in the UI
      if (optimistic) {
        await qc.cancelQueries({ queryKey: ['deposit-messages', depositId] })
        qc.setQueryData(['deposit-messages', depositId], (prev) => {
          if (!prev) return prev
          const list = prev.data?.data ?? []
          return { ...prev, data: { ...prev.data, data: [...list, optimistic] } }
        })
      }
    },
    onSuccess: (res) => {
      // Replace optimistic message with real one from server
      qc.invalidateQueries({ queryKey: ['deposit-messages', depositId] })
    },
    onError: () => {
      // Revert optimistic on error
      qc.invalidateQueries({ queryKey: ['deposit-messages', depositId] })
    },
  })

  const canSend = (text.trim() || file) && !postM.isPending

  const handleSend = () => {
    if (!canSend) return
    setComposerErr('')
    const trimmed = text.trim()
    if (trimmed.length > 5000) { setComposerErr('Message is too long (max 5000 characters).'); return }

    // Create optimistic message for instant display
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      deposit_id: depositId,
      sender: currentUserId,
      sender_name: 'You',
      sender_role: '',
      message: trimmed,
      attachment_url: null,
      attachment_name: file?.name || '',
      attachment_size_kb: file ? Math.round(file.size / 1024) : null,
      is_protected: false,
      password_hint: '',
      created_at: new Date().toISOString(),
    }

    const fd = new FormData()
    if (trimmed) fd.append('message', trimmed)
    if (file) fd.append('attachment', file)
    postM.mutate({ id: depositId, fd, optimistic: optimisticMsg })
    // Clear input immediately for snappy feel
    setText('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const fmtTime = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  const roleLabel = (r) => {
    if (r === 'rm')          return { txt: 'RM',          bg: 'bg-blue-100',   text: 'text-blue-700' }
    if (r === 'back_office') return { txt: 'Back Office', bg: 'bg-purple-100', text: 'text-purple-700' }
    if (r === 'admin')       return { txt: 'Admin',       bg: 'bg-amber-100',  text: 'text-amber-700' }
    return { txt: r || '—', bg: 'bg-gray-100', text: 'text-gray-600' }
  }

  return (
    <div className="flex flex-col h-[440px] border border-gray-200 rounded-xl bg-gradient-to-b from-gray-50/60 to-white overflow-hidden shadow-inner">
      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center h-full text-xs text-gray-400 gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading conversation—
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3 shadow-sm">
              <MessageSquare size={22} className="text-accent" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">Start the conversation. Attach files if needed.</p>
          </div>
        )}
        {messages.map((m, idx) => {
          const mine = m.sender === currentUserId
          const role = roleLabel(m.sender_role)
          const prev = messages[idx - 1]
          const sameSenderAsPrev = prev && prev.sender === m.sender
          const showHeader = !sameSenderAsPrev
          const initials = (m.sender_name || '?').slice(0, 2).toUpperCase()
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} ${sameSenderAsPrev ? '-mt-2' : ''}`}>
              <div className="shrink-0 w-8 h-8">
                {showHeader && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${mine ? 'bg-accent text-white' : `${role.bg} ${role.text}`}`}>
                    {initials}
                  </div>
                )}
              </div>
              <div className={`max-w-[75%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {showHeader && (
                  <div className={`flex items-center gap-1.5 mb-1 px-1 ${mine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] font-semibold text-gray-700">{m.sender_name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${role.bg} ${role.text} uppercase tracking-wide`}>{role.txt}</span>
                  </div>
                )}
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                  mine ? 'bg-accent text-white rounded-br-md' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                }`}>
                  {m.message && <p className="whitespace-pre-wrap break-words leading-snug">{m.message}</p>}
                  {m.attachment_url && (
                    <div className={`${m.message ? 'mt-2' : ''} flex items-start gap-2.5 rounded-xl px-2.5 py-2 ${mine ? 'bg-white/15' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${mine ? 'bg-white/20' : 'bg-accent/10'}`}>
                        <Paperclip size={15} className={mine ? 'text-white' : 'text-accent'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[11px] font-semibold truncate ${mine ? 'text-white' : 'text-gray-800'}`}>{m.attachment_name || 'Attachment'}</p>
                        <p className={`text-[10px] ${mine ? 'text-white/70' : 'text-gray-500'}`}>{m.attachment_size_kb ? `${m.attachment_size_kb} KB` : ''}</p>
                        <a href={m.attachment_url} target="_blank" rel="noreferrer"
                          className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold ${mine ? 'text-white hover:underline' : 'text-accent hover:text-accent-dark'}`}>
                          <ExternalLink size={9} /> View
                        </a>
                        <button onClick={() => downloadFile(m.attachment_url, m.attachment_name || 'attachment')}
                          className={`mt-1 ml-2 inline-flex items-center gap-1 text-[10px] font-bold ${mine ? 'text-white hover:underline' : 'text-green-600 hover:text-green-700'}`}>
                          <Download size={9} /> Download
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <p className={`text-[10px] text-gray-400 mt-1 px-1 flex items-center gap-1 ${mine ? 'justify-end' : ''}`}>
                  {fmtTime(m.created_at)}
                  {mine && (
                    <span className="inline-flex">
                      {m.read_status === 'read' ? (
                        <svg width="16" height="11" viewBox="0 0 16 11" className="text-blue-500">
                          <path d="M0.5 5.5L3.5 8.5L8 4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M5 5.5L8 8.5L15 1.5" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : m.read_status === 'delivered' ? (
                        <svg width="16" height="11" viewBox="0 0 16 11" className="text-gray-400">
                          <path d="M0.5 5.5L3.5 8.5L8 4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M5 5.5L8 8.5L15 1.5" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="12" height="11" viewBox="0 0 12 11" className="text-gray-400">
                          <path d="M1 5.5L4 8.5L11 1.5" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 bg-white px-4 pt-3 pb-3">
        {file && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-2">
            <Paperclip size={13} className="text-accent mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-gray-800 truncate">{file.name}</p>
              <p className="text-[10px] text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button type="button" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
              className="text-gray-400 hover:text-red-500" title="Remove file">
              <X size={13} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setComposerErr('') }} />
          <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file"
            className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors">
            <Paperclip size={15} />
          </button>
          <textarea
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); if (composerErr) setComposerErr('') }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            onPaste={(e) => {
              const items = e.clipboardData?.items
              if (!items) return
              for (const item of items) {
                if (item.type.startsWith('image/')) {
                  e.preventDefault()
                  const blob = item.getAsFile()
                  if (blob) setFile(blob)
                  return
                }
              }
            }}
            maxLength={5000}
            placeholder="Type a message—  (Enter to send)"
            className={`flex-1 resize-none text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent max-h-32 ${composerErr ? 'border-red-300' : 'border-gray-200'}`}
          />
          <button type="button" onClick={handleSend} disabled={!canSend}
            className="shrink-0 w-9 h-9 rounded-lg bg-accent hover:bg-accent-dark text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title="Send">
            <Send size={15} />
          </button>
        </div>
        {composerErr && <p className="mt-1.5 text-[11px] text-red-600">{composerErr}</p>}
        <p className="mt-1.5 text-[10px] text-gray-400 flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${wsLive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          {wsLive ? 'Live — connected' : 'Reconnecting—'}
        </p>
      </div>
    </div>
  )
}

// -- Deposit Timeline (View modal content) ----------------------------------
function DepositTimeline({ deposit, initialTab = 'timeline' }) {
  const [tab, setTab] = useState(initialTab)
  const { user } = useAuthStore()
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
      {/* Tab toggle */}
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab('timeline')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            tab === 'timeline' ? 'bg-white text-accent shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock size={11} className="inline -mt-0.5 mr-1" /> Timeline
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            tab === 'chat' ? 'bg-white text-accent shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <MessageSquare size={11} className="inline -mt-0.5 mr-1" /> Chat
        </button>
      </div>

      {tab === 'chat' ? (
        <DepositChat depositId={deposit.id} currentUserId={user?.id} />
      ) : (
      <>
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
            <div className="flex items-center gap-2">
              <a href={deposit.slip} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium">
                <ExternalLink size={11} /> View
              </a>
              <button onClick={() => downloadFile(deposit.slip, `rm-slip-${deposit.ark_id || 'file'}`)}
                className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline font-medium">
                <Download size={11} /> Download
              </button>
            </div>
          </div>
        )}
        {deposit.review_slip && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Backoffice Receipt</span>
            <div className="flex items-center gap-2">
              <a href={deposit.review_slip} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline font-medium">
                <ExternalLink size={11} /> View
              </a>
              <button onClick={() => downloadFile(deposit.review_slip, `receipt-${deposit.ark_id || 'file'}`)}
                className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline font-medium">
                <Download size={11} /> Download
              </button>
            </div>
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
        {isLoading && <p className="text-xs text-gray-400">Loading—</p>}
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
                    <div className="flex items-center gap-2 mt-1">
                      <a href={a.slip_url.startsWith('http') ? a.slip_url : a.slip_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                        <Paperclip size={10} /> View slip
                      </a>
                      <button onClick={() => downloadFile(a.slip_url, `slip-${a.id}`)}
                        className="inline-flex items-center gap-1 text-[11px] text-green-600 hover:underline">
                        <Download size={10} /> Download
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </>
      )}
    </div>
  )
}

// -- Main Page --------------------------------------------------------------
export default function Deposits() {
  const qc   = useQueryClient()
  const { user, hasPermission } = useAuthStore()
  const canCreate = hasPermission('deposits', 'create')
  const canEdit   = hasPermission('deposits', 'edit')
  const canDelete = hasPermission('deposits', 'delete')
  const canActivate = hasPermission('deposits', 'activate')
  const canReview = hasPermission('deposits', 'review')
  const canChat   = hasPermission('deposits', 'chat')
  const canViewDetails = hasPermission('deposits', 'view_details')
  const canComplete = hasPermission('deposits', 'complete')
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
  const [completeTarget,  setCompleteTarget]  = useState(null)
  const fmtDate = (d) => d
    ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : '—'

  // Debounce search — wait 400ms after last keystroke before firing API
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  // Deep-link from notification click: ?ticket=<id>
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const tid = searchParams.get('ticket')
    if (!tid) return
    let cancelled = false
    getDeposit(tid)
      .then((res) => {
        if (cancelled) return
        const dep = res?.data?.data ?? res?.data
        if (dep) setModal({ mode: 'view', data: dep, tab: 'chat' })
      })
      .catch(() => { /* ticket may have been deleted */ })
      .finally(() => {
        const next = new URLSearchParams(searchParams)
        next.delete('ticket')
        setSearchParams(next, { replace: true })
      })
    return () => { cancelled = true }
  }, [searchParams, setSearchParams])

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
    if (key === 'problem')       return (row.problem_category ?? '').toLowerCase()
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
  const toggleStatusM = useMutation({
    mutationFn: ({ id, currentStatus }) => {
      const fd = new FormData()
      if (currentStatus === 'completed') {
        fd.append('status', 'pending')
      } else {
        fd.append('status', 'completed')
      }
      return updateDeposit(id, fd)
    },
    onSuccess: inv,
  })

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
            <input className="input pl-9" placeholder="Search gateway, channel, ARK ID—" value={search}
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
              <SortableTh label="ARK ID"          sortKey="ark_id"         toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Amount (₹)"     sortKey="amount"         toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="UTR Number"      sortKey="utr_number"     toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Slip"            sortKey="slip"           toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Comment"         sortKey="comment"        toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Logged By"       sortKey="logged_by"      toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Created At"      sortKey="created_at"     toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Problem"         sortKey="problem"        toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Ticket Status"   sortKey="ticket_status"  toggle={toggleSort} icon={sortIcon} />
              {(canWrite || canReview || canChat) && (
                <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-center">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.length === 0 && (
              <tr><td colSpan={canWrite || canReview || canChat ? 13 : 12} className="px-4 py-10 text-center text-gray-400 text-sm">
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
                {/* Channel Detail - removed, channel item selection no longer used */}
                <td className="px-4 py-2.5 text-xs text-gray-600 text-center">{r.ark_id || '-'}</td>
                {/* Amount */}
                <td className="px-4 py-2.5 text-xs text-gray-600 text-center font-semibold">{r.amount ? `₹${parseFloat(r.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                {/* UTR Number */}
                <td className="px-4 py-2.5 text-xs text-gray-600 text-center font-mono">{r.utr_number || '-'}</td>
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
                {/* Problem Category */}
                <td className="px-4 py-2.5 text-xs text-gray-600 text-center">
                  {r.problem_category
                    ? (PROBLEM_CATEGORY_OPTS.find(o => o.value === r.problem_category)?.label || r.problem_category)
                    : '—'}
                </td>
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
                {(canWrite || canReview || canChat) && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 justify-center">
                      {/* View timeline */}
                      {canViewDetails && (
                      <button onClick={() => setModal({ mode: 'view', data: r })}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-accent transition-colors" title="View Timeline">
                        <Eye size={12} />
                      </button>
                      )}
                      {/* Chat */}
                      {canChat && (
                        <button onClick={() => setModal({ mode: 'view', data: r, tab: 'chat' })}
                          className="relative inline-flex items-center justify-center w-7 h-7 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors" title="Open Chat">
                          <MessageSquare size={12} />
                          {r.message_count > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                              {r.message_count > 9 ? '9+' : r.message_count}
                            </span>
                          )}
                        </button>
                      )}
                      {/* Toggle status: Not Added ? Completed (only with complete permission) */}
                      {canComplete && (
                        <button
                          onClick={() => setCompleteTarget(r)}
                          disabled={toggleStatusM.isPending}
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                            r.status === 'completed'
                              ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                              : 'bg-teal-50 text-teal-500 hover:bg-teal-100'
                          }`}
                          title={r.status === 'completed' ? 'Mark as Not Added' : 'Mark as Completed'}
                        >
                          <ArrowLeftRight size={12} />
                        </button>
                      )}
                      {canReview && r.status !== 'completed' && (
                        <button onClick={() => setModal({ mode: 'review', data: r })}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-green-50 text-green-500 hover:bg-green-100 transition-colors" title="Review">
                          <CheckCircle2 size={12} />
                        </button>
                      )}
                    {canEdit && (
                      <button onClick={() => setModal({ mode: 'edit', data: r })}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <SquarePen size={12} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDelTarget(r)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                        <Trash2 size={12} />
                      </button>
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
      <Modal open={modal?.mode === 'view'} onClose={() => { setModal(null); inv() }} title="Deposit Timeline" size="lg">
        {modal?.mode === 'view' && modal?.data && (
          <DepositTimeline deposit={modal.data} initialTab={modal.tab ?? 'timeline'} />
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

      {/* Mark as Completed / Revert Confirm */}
      <ConfirmDialog
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        onConfirm={() => { toggleStatusM.mutate({ id: completeTarget.id, currentStatus: completeTarget.status }); setCompleteTarget(null) }}
        loading={toggleStatusM.isPending}
        title={completeTarget?.status === 'completed' ? 'Revert to Pending' : 'Mark as Completed'}
        confirmLabel={completeTarget?.status === 'completed' ? 'Revert' : 'Complete'}
        variant={completeTarget?.status === 'completed' ? 'danger' : 'success'}
        message={completeTarget?.status === 'completed'
          ? 'Are you sure you want to revert this deposit back to pending?'
          : 'Are you sure you want to mark this deposit as completed?'
        }
      />
    </div>
  )
}
