import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, Search, X, CheckCircle2, XCircle, Clock,
  IndianRupee, User, Hash, Calendar, TrendingUp, SquarePen, Eye,
  Upload, FileText, AlertTriangle, Mail, PhoneOff, ExternalLink, MessageSquare,
  Send, Paperclip, Lock, Lock as LockIcon, Info, Shield, Loader2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  getWithdrawals, getWithdrawal, createWithdrawal, updateWithdrawal, deleteWithdrawal,
  uploadSlip, confirmReceived, notReceived, markEmailSent,
  getMessages, postMessage, manualClose,
} from '../api/withdrawals'
import { connectWS } from '../api/ws'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'
import {
  clientArcId as vClientArcId, safeName as vSafeName, positiveAmount as vPositiveAmount,
  slipFile as vSlipFile, attachmentFile as vAttachmentFile, extractApiErrors,
} from '../utils/validators'

// ── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  pending:                { label: 'Pending',            bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  Icon: Clock },
  slip_uploaded:          { label: 'Slip Uploaded',      bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   Icon: FileText },
  bank_followup_required: { label: 'Follow-Up Required', bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    Icon: AlertTriangle },
  email_sent_to_bank:     { label: 'Email Sent',         bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', Icon: Mail },
  closed:                 { label: 'Closed',             bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  Icon: CheckCircle2 },
  approved:               { label: 'Approved',           bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  Icon: CheckCircle2 },
  rejected:               { label: 'Rejected',           bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    Icon: XCircle },
}

function StatusChip({ status }) {
  const cfg = STATUS[status] ?? STATUS.pending
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

// ── Create / Edit withdrawal form ────────────────────────────────────────────
function WithdrawalForm({ initial, onSubmit, onClose, loading, apiErrors = {} }) {
  const isEdit = !!initial

  const toLocal = (d) => {
    if (!d) return ''
    const dt = new Date(d)
    const pad = (n) => String(n).padStart(2, '0')
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  }

  const [form, setForm] = useState({
    client_arc_id:       initial?.client_arc_id       ?? '',
    client_name:         initial?.client_name         ?? '',
    amount:              initial?.amount               ?? '',
    withdrawal_datetime: toLocal(initial?.withdrawal_datetime),
    comment:             initial?.comment              ?? '',
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (key) => (e) => {
    const v = e.target?.value ?? e
    setForm(p => ({ ...p, [key]: v }))
    if (local[key]) setLocal((p) => ({ ...p, [key]: undefined }))
  }

  const validate = () => {
    const errs = {}
    const arcErr = vClientArcId(form.client_arc_id)
    if (arcErr) errs.client_arc_id = arcErr
    const nameErr = vSafeName(form.client_name, 'Client name', 150)
    if (nameErr) errs.client_name = nameErr
    const amtErr = vPositiveAmount(form.amount, { label: 'Amount' })
    if (amtErr) errs.amount = amtErr
    if (!form.withdrawal_datetime) errs.withdrawal_datetime = 'Date & time is required.'
    if (form.comment && form.comment.length > 2000) errs.comment = 'Comment must be at most 2000 characters.'
    setLocal(errs)
    return Object.keys(errs).length === 0
  }

  const submit = (e) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-start justify-between px-6 py-4 rounded-t-2xl bg-accent">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? 'Edit Withdrawal Request' : 'New Withdrawal Request'}</h2>
            <p className="text-xs text-white/70 mt-0.5">
              {isEdit ? 'Update your pending withdrawal request' : 'Raise a client withdrawal ticket for back-office processing'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors ml-4 mt-0.5 p-1 rounded-lg hover:bg-white/10"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">ARC ID <span className="text-red-500">*</span></label>
              <div className="relative">
                <Hash size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={`input pl-8 ${errors.client_arc_id ? 'border-red-300' : ''}`}
                  placeholder="Client ARC ID"
                  value={form.client_arc_id}
                  onChange={f('client_arc_id')}
                  maxLength={50}
                />
              </div>
              {errors.client_arc_id && <p className="mt-1 text-xs text-red-600">{errors.client_arc_id}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Client Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={`input pl-8 ${errors.client_name ? 'border-red-300' : ''}`}
                  placeholder="Full name"
                  value={form.client_name}
                  onChange={f('client_name')}
                  maxLength={150}
                />
              </div>
              {errors.client_name && <p className="mt-1 text-xs text-red-600">{errors.client_name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Amount (₹) <span className="text-red-500">*</span></label>
              <div className="relative">
                <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={`input pl-8 ${errors.amount ? 'border-red-300' : ''}`}
                  type="number" min="0.01" step="0.01" placeholder="0.00"
                  value={form.amount}
                  onChange={f('amount')}
                />
              </div>
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date &amp; Time <span className="text-red-500">*</span></label>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={`input pl-8 ${errors.withdrawal_datetime ? 'border-red-300' : ''}`}
                  type="datetime-local"
                  value={form.withdrawal_datetime}
                  onChange={f('withdrawal_datetime')}
                />
              </div>
              {errors.withdrawal_datetime && <p className="mt-1 text-xs text-red-600">{errors.withdrawal_datetime}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Comment <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              rows={3}
              className={`input resize-none ${errors.comment ? 'border-red-300' : ''}`}
              placeholder="Add any notes or instructions for back office…"
              maxLength={2000}
              value={form.comment}
              onChange={f('comment')}
            />
            {errors.comment && <p className="mt-1 text-xs text-red-600">{errors.comment}</p>}
          </div>

          {errors.non_field && <p className="text-xs text-red-600">{errors.non_field}</p>}

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Upload Slip Modal (Back Office) ─────────────────────────────────────────
function UploadSlipModal({ onSubmit, onClose, loading, apiErrors = {} }) {
  const [file, setFile] = useState(null)
  const [note, setNote] = useState('')
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }

  const validate = () => {
    const errs = {}
    if (!file) errs.slip = 'Please attach the slip file.'
    else {
      const fe = vSlipFile(file)
      if (fe) errs.slip = fe
    }
    if (note && note.length > 1000) errs.note = 'Note must be at most 1000 characters.'
    setLocal(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const fd = new FormData()
    fd.append('slip', file)
    fd.append('note', note)
    onSubmit(fd)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <FileText size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Upload the bank slip / proof of withdrawal. The RM will be notified to verify receipt with the client.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Slip File <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,.pdf,application/pdf"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (local.slip) setLocal((p) => ({ ...p, slip: undefined })) }}
          className={`block w-full text-xs text-gray-600
            file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
            file:text-xs file:font-semibold file:bg-accent/10 file:text-accent
            hover:file:bg-accent/20 transition-colors cursor-pointer
            border rounded-lg ${errors.slip ? 'border-red-300' : 'border-gray-200'}`}
        />
        {file && (
          <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
            <FileText size={11} /> {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
        )}
        {errors.slip && <p className="mt-1 text-xs text-red-600">{errors.slip}</p>}
        <p className="mt-1 text-[10px] text-gray-400">PDF, JPG, PNG or WEBP · max 8 MB.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Note <span className="text-gray-400 font-normal">(optional)</span></label>
        <textarea rows={2}
          className={`input resize-none ${errors.note ? 'border-red-300' : ''}`}
          placeholder="Any remarks for the RM…"
          maxLength={1000}
          value={note}
          onChange={(e) => { setNote(e.target.value); if (local.note) setLocal((p) => ({ ...p, note: undefined })) }}
        />
        {errors.note && <p className="mt-1 text-xs text-red-600">{errors.note}</p>}
      </div>

      {errors.non_field && <p className="text-xs text-red-600">{errors.non_field}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          <Upload size={14} /> {loading ? 'Uploading…' : 'Upload Slip'}
        </button>
      </div>
    </form>
  )
}

// ── Not Received Modal (RM) ─────────────────────────────────────────────────
function NotReceivedModal({ onSubmit, onClose, loading, apiErrors = {} }) {
  const [remarks, setRemarks] = useState('')
  const [err, setErr] = useState('')
  const handle = () => {
    const t = remarks.trim()
    if (t.length < 3) { setErr('Please describe what the client reported (at least 3 characters).'); return }
    if (t.length > 2000) { setErr('Remarks must be at most 2000 characters.'); return }
    onSubmit({ followup_remarks: t })
  }
  const apiMsg = apiErrors.followup_remarks || apiErrors.non_field
  return (
    <div className="space-y-4">
      <div className="flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
        <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
        <p className="text-xs text-red-700">
          This will alert <strong>Back Office</strong> that the client has <strong>not received</strong> the
          withdrawal amount. They will need to follow up with the bank manually.
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Client Remarks <span className="text-red-500">*</span>
        </label>
        <textarea rows={3}
          className={`input resize-none ${err || apiMsg ? 'border-red-300' : ''}`}
          placeholder="What did the client report? (e.g. UPI failed, money not credited in bank…)"
          maxLength={2000}
          value={remarks}
          onChange={(e) => { setRemarks(e.target.value); if (err) setErr('') }}
        />
        {(err || apiMsg) && <p className="mt-1 text-xs text-red-600">{err || apiMsg}</p>}
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button disabled={loading} onClick={handle}
          className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-60">
          <AlertTriangle size={14} /> {loading ? 'Notifying…' : 'Notify Back Office'}
        </button>
      </div>
    </div>
  )
}

// ── Email Sent Modal (Back Office) ──────────────────────────────────────────
function EmailSentModal({ onSubmit, onClose, loading, apiErrors = {} }) {
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const handle = () => {
    if (note.length > 1000) { setErr('Note must be at most 1000 characters.'); return }
    onSubmit({ bank_followup_note: note })
  }
  const apiMsg = apiErrors.bank_followup_note || apiErrors.non_field
  return (
    <div className="space-y-4">
      <div className="flex gap-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
        <Mail size={16} className="text-purple-500 shrink-0 mt-0.5" />
        <p className="text-xs text-purple-700">
          Confirm that you have <strong>emailed the bank</strong> regarding this pending withdrawal.
          Add any reference details if you wish.
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Follow-up Note <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea rows={3}
          className={`input resize-none ${err || apiMsg ? 'border-red-300' : ''}`}
          placeholder="e.g. Emailed bank operations team at 3:15 PM, reference #BNK-12345…"
          maxLength={1000}
          value={note}
          onChange={(e) => { setNote(e.target.value); if (err) setErr('') }}
        />
        {(err || apiMsg) && <p className="mt-1 text-xs text-red-600">{err || apiMsg}</p>}
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button disabled={loading} onClick={handle}
          className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-60">
          <Mail size={14} /> {loading ? 'Saving…' : 'Confirm Email Sent'}
        </button>
      </div>
    </div>
  )
}

// ── Conversation thread (RM ↔ Back Office) ─────────────────────────────────
function MessageThread({ withdrawalId, currentUserId }) {
  const qc = useQueryClient()
  const [text, setText]         = useState('')
  const [file, setFile]         = useState(null)
  const [isProt, setIsProt]     = useState(false)
  const [hint, setHint]         = useState('')
  const [wsLive, setWsLive]     = useState(false)
  const fileInputRef            = useRef(null)
  const scrollerRef             = useRef(null)

  const { data, isLoading } = useQuery({
    queryKey: ['wd-messages', withdrawalId],
    queryFn:  () => getMessages(withdrawalId),
  })
  const messages = data?.data?.data ?? []

  // ── Live WebSocket subscription ────────────────────────────────────────
  useEffect(() => {
    const { accessToken } = useAuthStore.getState()
    if (!accessToken || !withdrawalId) return
    const conn = connectWS(`/ws/withdrawals/${withdrawalId}/`, accessToken, {
      onOpen: () => setWsLive(true),
      onClose: () => setWsLive(false),
      onMessage: (data) => {
        if (data?.type === 'message_created' && data.message) {
          qc.setQueryData(['wd-messages', withdrawalId], (prev) => {
            if (!prev) return prev
            const list = prev.data?.data ?? []
            if (list.some(m => m.id === data.message.id)) return prev
            return { ...prev, data: { ...prev.data, data: [...list, data.message] } }
          })
        }
        if (data?.type === 'ticket_updated' && data.withdrawal) {
          qc.invalidateQueries({ queryKey: ['withdrawals'] })
          qc.invalidateQueries({ queryKey: ['withdrawal-stats'] })
        }
      },
    })
    return () => conn.close()
  }, [withdrawalId, qc])

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [messages.length])

  const postM = useMutation({
    mutationFn: ({ id, fd }) => postMessage(id, fd),
    onSuccess: () => {
      setText(''); setFile(null); setIsProt(false); setHint('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      qc.invalidateQueries({ queryKey: ['wd-messages', withdrawalId] })
      qc.invalidateQueries({ queryKey: ['wd-notifications-unread'] })
      qc.invalidateQueries({ queryKey: ['wd-notifications-list'] })
    },
  })

  const canSend = (text.trim() || file) && !postM.isPending
  const [composerErr, setComposerErr] = useState('')

  const handleSend = () => {
    if (!canSend) return
    setComposerErr('')
    // Validate
    const trimmed = text.trim()
    if (trimmed.length > 5000) { setComposerErr('Message is too long (max 5000 characters).'); return }
    if (file) {
      const fe = vAttachmentFile(file)
      if (fe) { setComposerErr(fe); return }
      if (isProt && hint.length > 200) {
        setComposerErr('Password hint must be at most 200 characters.'); return
      }
    }
    const fd = new FormData()
    if (trimmed) fd.append('message', trimmed)
    if (file) {
      fd.append('attachment', file)
      fd.append('is_protected', isProt ? 'true' : 'false')
      if (isProt && hint.trim()) fd.append('password_hint', hint.trim())
    }
    postM.mutate({ id: withdrawalId, fd })
  }

  const fmtTime = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  const roleLabel = (r) => {
    if (r === 'rm')           return { txt: 'RM',          bg: 'bg-blue-100',   text: 'text-blue-700' }
    if (r === 'back_office')  return { txt: 'Back Office', bg: 'bg-purple-100', text: 'text-purple-700' }
    if (r === 'admin')        return { txt: 'Admin',       bg: 'bg-amber-100',  text: 'text-amber-700' }
    return { txt: r || '—', bg: 'bg-gray-100', text: 'text-gray-600' }
  }

  return (
    <div className="flex flex-col h-[480px] border border-gray-200 rounded-xl bg-gradient-to-b from-gray-50/60 to-white overflow-hidden shadow-inner">
      {/* Messages */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={14} className="animate-spin" />
              Loading conversation…
            </div>
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3 shadow-sm">
              <MessageSquare size={22} className="text-accent" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">Start the conversation. Attach files and add password hints if needed.</p>
          </div>
        )}
        {messages.map((m, idx) => {
          const mine = m.sender === currentUserId
          const role = roleLabel(m.sender_role)
          const prev = messages[idx - 1]
          const sameSenderAsPrev = prev && prev.sender === m.sender
          const showHeader = !sameSenderAsPrev
          const initials = (m.sender_name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
          return (
            <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} ${sameSenderAsPrev ? '-mt-2' : ''}`}>
              {/* Avatar (only on first message of a streak) */}
              <div className="shrink-0 w-8 h-8">
                {showHeader ? (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${mine ? 'bg-accent text-white' : `${role.bg} ${role.text}`}`}>
                    {initials}
                  </div>
                ) : null}
              </div>

              <div className={`max-w-[75%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {/* Sender row */}
                {showHeader && (
                  <div className={`flex items-center gap-1.5 mb-1 px-1 ${mine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] font-semibold text-gray-700">{m.sender_name}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${role.bg} ${role.text} uppercase tracking-wide`}>{role.txt}</span>
                  </div>
                )}

                {/* Bubble */}
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                  mine
                    ? 'bg-gradient-to-br from-accent to-accent-dark text-white rounded-br-md'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                }`}>
                  {m.message && (
                    <p className="whitespace-pre-wrap break-words leading-snug">{m.message}</p>
                  )}

                  {m.attachment_url && (
                    <div className={`${m.message ? 'mt-2' : ''} flex items-start gap-2.5 rounded-xl px-2.5 py-2 ${
                      mine ? 'bg-white/15 backdrop-blur-sm' : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                        mine ? 'bg-white/20' : 'bg-accent/10'
                      }`}>
                        {m.is_protected
                          ? <LockIcon size={15} className={mine ? 'text-white' : 'text-accent'} />
                          : <Paperclip size={15} className={mine ? 'text-white' : 'text-accent'} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[11px] font-semibold truncate ${mine ? 'text-white' : 'text-gray-800'}`}>
                          {m.attachment_name || 'Attachment'}
                        </p>
                        <p className={`text-[10px] ${mine ? 'text-white/70' : 'text-gray-500'}`}>
                          {m.attachment_size_kb ? `${m.attachment_size_kb} KB` : ''}
                          {m.is_protected && <span className="ml-1 font-semibold">• protected</span>}
                        </p>
                        {m.is_protected && m.password_hint && (
                          <p className={`text-[10px] mt-0.5 italic ${mine ? 'text-white/80' : 'text-gray-500'}`}>
                            Hint: {m.password_hint}
                          </p>
                        )}
                        <a href={m.attachment_url} target="_blank" rel="noreferrer"
                          className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold ${
                            mine ? 'text-white hover:underline' : 'text-accent hover:text-accent-dark'
                          }`}>
                          <ExternalLink size={9} /> Open / download
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <p className={`text-[10px] text-gray-400 mt-1 px-1 ${mine ? 'text-right' : ''}`}>{fmtTime(m.created_at)}</p>
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

              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={isProt} onChange={(e) => setIsProt(e.target.checked)}
                  className="rounded accent-accent" />
                <Lock size={11} className="text-amber-500" />
                File is password-protected
              </label>
              {isProt && (
                <input
                  type="text"
                  placeholder="Optional password hint (e.g. last 4 of ARC ID)"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  className="mt-1.5 w-full text-[11px] px-2 py-1.5 rounded-md border border-amber-300 bg-amber-50/40 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => { setFile(null); setIsProt(false); setHint(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
              className="text-gray-400 hover:text-red-500"
              title="Remove file"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setComposerErr('') }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
          >
            <Paperclip size={15} />
          </button>

          <textarea
            rows={1}
            value={text}
            onChange={(e) => { setText(e.target.value); if (composerErr) setComposerErr('') }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            maxLength={5000}
            placeholder="Type a message…  (Enter to send · Shift+Enter for new line)"
            className={`flex-1 resize-none text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent max-h-32 ${composerErr ? 'border-red-300' : 'border-gray-200'}`}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 w-9 h-9 rounded-lg bg-accent hover:bg-accent-dark text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Send"
          >
            <Send size={15} />
          </button>
        </div>

        {composerErr && <p className="mt-1.5 text-[11px] text-red-600">{composerErr}</p>}

        <p className="mt-1.5 text-[10px] text-gray-400 flex items-center gap-1.5">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${wsLive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          {wsLive ? 'Live — connected' : 'Reconnecting…'}
        </p>
      </div>
    </div>
  )
}

// ── Detail / Communicate modal ──────────────────────────────────────────────
function DetailModal({ withdrawal, currentUserId, canReview, onMarkClose, initialTab = 'details' }) {
  const [tab, setTab] = useState(initialTab)

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab, withdrawal?.id])

  const fmtDt   = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const isClosed = withdrawal.status === 'closed'

  return (
    <div className="space-y-4">
      {/* Action row + tabs */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab('details')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'details' ? 'bg-white text-accent shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={11} className="inline -mt-0.5 mr-1" /> Details
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === 'chat' ? 'bg-white text-accent shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare size={11} className="inline -mt-0.5 mr-1" /> Conversation
          </button>
        </div>

        {canReview && !isClosed && (
          <button
            onClick={onMarkClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-semibold transition-colors"
          >
            <Shield size={12} /> Mark as Closed
          </button>
        )}
      </div>

      {tab === 'chat' ? (
        <MessageThread withdrawalId={withdrawal.id} currentUserId={currentUserId} />
      ) : (
        <div className="space-y-4">
          {/* Hero summary card */}
          <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-blue-50/40 to-white p-5">
            <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-accent/5" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Client</p>
                <p className="text-lg font-bold text-gray-900 truncate">{withdrawal.client_name || '—'}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-gray-500">
                  <Hash size={11} className="text-gray-400" />
                  <span className="font-semibold tracking-wide">{withdrawal.client_arc_id || '—'}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Amount</p>
                <p className="text-2xl font-bold text-accent-dark">₹{Number(withdrawal.amount).toLocaleString('en-IN')}</p>
                <div className="mt-1.5"><StatusChip status={withdrawal.status} /></div>
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { icon: Calendar,     label: 'Withdrawal Date', value: fmtDt(withdrawal.withdrawal_datetime) },
              { icon: User,         label: 'Submitted By',     value: withdrawal.submitted_by_name },
              { icon: Clock,        label: 'Submitted On',     value: fmtDate(withdrawal.created_at) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  <Icon size={10} /> {label}
                </div>
                <p className="mt-1 text-xs font-semibold text-gray-800 truncate">{value || '—'}</p>
              </div>
            ))}
          </div>

          {/* RM comment */}
          {withdrawal.comment && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
              <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <MessageSquare size={11} /> RM Note
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{withdrawal.comment}</p>
            </div>
          )}

          {/* Slip uploaded */}
          {withdrawal.slip_url && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
              <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                <FileText size={11} /> Slip Uploaded
                {withdrawal.slip_uploaded_by_name && <span className="font-normal ml-1 normal-case">by {withdrawal.slip_uploaded_by_name}</span>}
                {withdrawal.slip_uploaded_at && <span className="font-normal ml-1 normal-case">· {fmtDt(withdrawal.slip_uploaded_at)}</span>}
              </p>
              {withdrawal.slip_note && <p className="text-sm text-gray-700 mb-2">{withdrawal.slip_note}</p>}
              <a href={withdrawal.slip_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-dark">
                <ExternalLink size={12} /> View / download slip
              </a>
            </div>
          )}

          {/* RM follow-up remarks (client not received) */}
          {withdrawal.followup_remarks && (
            <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
              <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <AlertTriangle size={11} /> Client Did Not Receive
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{withdrawal.followup_remarks}</p>
            </div>
          )}

          {/* Back office bank follow-up */}
          {withdrawal.email_sent_at && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3">
              <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Mail size={11} /> Email Sent to Bank · {fmtDt(withdrawal.email_sent_at)}
              </p>
              {withdrawal.bank_followup_note
                ? <p className="text-sm text-gray-700 leading-relaxed">{withdrawal.bank_followup_note}</p>
                : <p className="text-sm text-gray-400 italic">No additional note</p>}
            </div>
          )}

          {/* Legacy review message */}
          {withdrawal.review_message && (
            <div className={`rounded-xl border px-4 py-3 ${withdrawal.status === 'approved' ? 'border-green-100 bg-green-50/40' : 'border-red-100 bg-red-50/40'}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${withdrawal.status === 'approved' ? 'text-green-600' : 'text-red-500'}`}>
                Back Office · {withdrawal.status}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{withdrawal.review_message}</p>
            </div>
          )}

          {withdrawal.status === 'pending' && !withdrawal.slip_url && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-400">
              <Clock size={12} className="text-amber-400" />
              Awaiting back-office to upload slip…
            </div>
          )}

          <button
            onClick={() => setTab('chat')}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-accent/30 text-accent hover:bg-accent/5 hover:border-accent/50 text-xs font-semibold transition-colors"
          >
            <MessageSquare size={13} /> Open conversation with the other party
          </button>
        </div>
      )}
    </div>
  )
}

// ── Manual Close modal ──────────────────────────────────────────────────────
function ManualCloseModal({ withdrawal, onSubmit, onClose, loading, apiErrors = {} }) {
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const apiMsg = apiErrors.note || apiErrors.non_field
  const handle = () => {
    if (note.length > 2000) { setErr('Note must be at most 2000 characters.'); return }
    onSubmit({ note })
  }
  return (
    <div className="space-y-4">
      <div className="flex gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
        <Shield size={16} className="text-green-600 shrink-0 mt-0.5" />
        <p className="text-xs text-green-700">
          Close this ticket for <strong>{withdrawal.client_name}</strong> (₹{Number(withdrawal.amount).toLocaleString('en-IN')}).
          The RM will be notified. Add a closing note if you like — it will also be posted in the conversation.
        </p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Closing Note <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea rows={3}
          className={`input resize-none ${err || apiMsg ? 'border-red-300' : ''}`}
          placeholder="e.g. Bank confirmed credit posted on client's account. Re-payment done manually via NEFT."
          maxLength={2000}
          value={note}
          onChange={(e) => { setNote(e.target.value); if (err) setErr('') }}
        />
        {(err || apiMsg) && <p className="mt-1 text-xs text-red-600">{err || apiMsg}</p>}
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button onClick={onClose}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button disabled={loading} onClick={handle}
          className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors inline-flex items-center gap-1.5 disabled:opacity-60">
          <Shield size={14} /> {loading ? 'Closing…' : 'Close Ticket'}
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
  const [pageSize, setPageSize]   = useState(25)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [sortBy, setSortBy]       = useState('created_at')
  const [sortDir, setSortDir]     = useState('desc')
  const [showForm, setShowForm]   = useState(false)
  const [editTarget, setEdit]     = useState(null)
  const [viewTarget, setView]     = useState(null)
  const [delTarget, setDel]       = useState(null)
  const [slipTarget, setSlip]     = useState(null)
  const [notRcvdTarget, setNotR]  = useState(null)
  const [emailTarget, setEmail]   = useState(null)
  const [confirmTarget, setCfm]   = useState(null)
  const [closeTarget, setClose]   = useState(null)

  // Deep-link from notification click: ?ticket=<id>&chat=1
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const tid  = searchParams.get('ticket')
    const chat = searchParams.get('chat') === '1'
    if (!tid) return
    let cancelled = false
    getWithdrawal(tid)
      .then((res) => {
        if (cancelled) return
        const wd = res?.data?.data ?? res?.data
        if (wd) setView({ ...wd, __openChat: chat })
      })
      .catch(() => { /* silently ignore — ticket may have been deleted */ })
      .finally(() => {
        // strip the query params so refresh / re-open behaves cleanly
        const next = new URLSearchParams(searchParams)
        next.delete('ticket'); next.delete('chat')
        setSearchParams(next, { replace: true })
      })
    return () => { cancelled = true }
  }, [searchParams, setSearchParams])

  const { data, isLoading } = useQuery({
    queryKey: ['withdrawals', page, pageSize, search, statusFilter, sortBy, sortDir],
    queryFn:  () => getWithdrawals({
      page,
      page_size: pageSize,
      search: search || undefined,
      status: statusFilter || undefined,
      history: 'false',
      ordering: sortBy ? `${sortDir === 'desc' ? '-' : ''}${sortBy}` : undefined,
    }),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1
  const followupCount = records.filter(r => r.status === 'bank_followup_required').length

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['withdrawals'] })
    qc.invalidateQueries({ queryKey: ['withdrawal-stats'] })
    qc.invalidateQueries({ queryKey: ['wd-notifications-unread'] })
    qc.invalidateQueries({ queryKey: ['wd-notifications-list'] })
  }

  const createM       = useMutation({ mutationFn: createWithdrawal,                 onSuccess: () => { inv(); setShowForm(false) } })
  const updateM       = useMutation({ mutationFn: ({id,d}) => updateWithdrawal(id,d), onSuccess: () => { inv(); setEdit(null) } })
  const deleteM       = useMutation({ mutationFn: deleteWithdrawal,                 onSuccess: () => { inv(); setDel(null) } })
  const uploadSlipM   = useMutation({ mutationFn: ({id,d}) => uploadSlip(id,d),     onSuccess: () => { inv(); setSlip(null) } })
  const confirmM      = useMutation({ mutationFn: confirmReceived,                  onSuccess: () => { inv(); setCfm(null) } })
  const notRcvdM      = useMutation({ mutationFn: ({id,d}) => notReceived(id,d),    onSuccess: () => { inv(); setNotR(null) } })
  const emailSentM    = useMutation({ mutationFn: ({id,d}) => markEmailSent(id,d),  onSuccess: () => { inv(); setEmail(null) } })
  const closeM        = useMutation({ mutationFn: ({id,d}) => manualClose(id,d),    onSuccess: () => { inv(); setClose(null); setView(null) } })

  const handleCreate = (form) => {
    const payload = {}
    Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') payload[k] = v })
    createM.mutate(payload)
  }
  const handleEdit = (form) => {
    const payload = {}
    Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') payload[k] = v })
    updateM.mutate({ id: editTarget.id, d: payload })
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const fmtDt   = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  if (isLoading) return <PageSpinner />

  const COLUMNS = [
    { key: 'client', label: 'Client', sortable: true, field: 'client_name' },
    { key: 'arc', label: 'ARC ID', sortable: true, field: 'client_arc_id' },
    { key: 'amount', label: 'Amount', sortable: true, field: 'amount' },
    { key: 'datetime', label: 'Date & Time', sortable: true, field: 'withdrawal_datetime' },
    { key: 'status', label: 'Status', sortable: true, field: 'status' },
    { key: 'submitted', label: 'Submitted', sortable: true, field: 'submitted_by_name' },
    { key: 'actions', label: 'Actions', sortable: false },
  ]

  const toggleSort = (field) => {
    if (!field) return
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const sortMarker = (field) => {
    if (!field) return ''
    if (sortBy !== field) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Withdrawals</h1>
          <p className="page-subtitle">{total} ticket{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> New Request
        </button>
      </div>

      {/* Bank follow-up alert banner (back office / admin) */}
      {canReview && followupCount > 0 && (
        <div className="flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center shrink-0 animate-pulse">
            <AlertTriangle size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">Bank Follow-Up Required</p>
            <p className="text-xs text-red-600 mt-0.5">
              {followupCount} client{followupCount > 1 ? 's have' : ' has'} not received their withdrawal amount.
              Please email the bank and mark each ticket as “Email Sent” below.
            </p>
          </div>
          <button onClick={() => { setStatus('bank_followup_required'); setPage(1) }}
            className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors whitespace-nowrap">
            View All
          </button>
        </div>
      )}

      {/* Filters + Pagination */}
      <div className="card py-4 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-[320px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search client name, ARC ID…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="input max-w-[200px]" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="slip_uploaded">Slip Uploaded</option>
            <option value="bank_followup_required">Follow-Up Required</option>
            <option value="email_sent_to_bank">Email Sent</option>
            <option value="closed">Closed</option>
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
            <tr className="border-b border-gray-100 bg-gray-50/80 text-center">
              {COLUMNS.map((col, idx) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && toggleSort(col.field)}
                  className={`px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider ${col.label === 'Actions' ? 'text-right' : idx === 0 ? 'text-left' : ''} ${col.sortable ? 'cursor-pointer select-none hover:text-accent' : ''}`}
                >
                  {col.label}{sortMarker(col.field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && (
              <tr><td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                {isRM ? 'No withdrawal tickets yet. Use "New Request" to raise one.' : 'No withdrawal tickets found.'}
              </td></tr>
            )}
            {records.map((r) => {
              const isOwnTicket  = isRM && r.submitted_by === user?.id
              const needsAttention = r.status === 'bank_followup_required'
              return (
                <tr key={r.id} className={`transition-colors ${needsAttention && canReview ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-blue-50/20'}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-800 text-xs">{r.client_name}</p>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-600 text-center">{r.client_arc_id}</td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-0.5 font-bold text-gray-800 text-xs">
                      <IndianRupee size={11} className="text-gray-400" />
                      {Number(r.amount).toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar size={11} className="text-gray-300 shrink-0" />
                      {fmtDt(r.withdrawal_datetime)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center"><StatusChip status={r.status} /></td>
                  <td className="px-4 py-2.5 text-[11px] text-gray-400 whitespace-nowrap text-center">
                    <div className="font-medium text-gray-600">{r.submitted_by_name}</div>
                    <div className="text-gray-300">{fmtDate(r.created_at)}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      {/* View / details */}
                      <button onClick={() => setView(r)} title="View Details"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-accent transition-colors">
                        <Eye size={13} />
                      </button>

                      {/* Edit */}
                      {(canReview || isOwnTicket) && (
                        <button onClick={() => setEdit(r)} title="Edit"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                          <SquarePen size={13} />
                        </button>
                      )}

                      {/* Conversation */}
                      <button onClick={() => { setView({ ...r, __openChat: true }) }} title="Open Conversation"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors">
                        <MessageSquare size={13} />
                      </button>

                      {/* Back Office: Upload Slip (pending) */}
                      {canReview && r.status === 'pending' && (
                        <button onClick={() => setSlip(r)} title="Upload Slip"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors">
                          <Upload size={13} />
                        </button>
                      )}

                      {/* RM: Confirm received (slip_uploaded) */}
                      {isOwnTicket && r.status === 'slip_uploaded' && (
                        <button onClick={() => setCfm(r)} title="Client Received Amount"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-green-100 text-green-600 hover:bg-green-200 transition-colors">
                          <CheckCircle2 size={13} />
                        </button>
                      )}

                      {/* RM: Not received (slip_uploaded) */}
                      {isOwnTicket && r.status === 'slip_uploaded' && (
                        <button onClick={() => setNotR(r)} title="Client Did Not Receive Amount"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
                          <PhoneOff size={13} />
                        </button>
                      )}

                      {/* Back Office: Mark email sent (bank_followup_required) */}
                      {canReview && r.status === 'bank_followup_required' && (
                        <button onClick={() => setEmail(r)} title="Mark Email Sent to Bank"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors animate-pulse">
                          <Mail size={13} />
                        </button>
                      )}

                      {/* Delete: admin always; RM only on own (any status) */}
                      {(role === 'admin' || isOwnTicket) && (
                        <button onClick={() => setDel(r)} title="Delete"
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
      </div>

      {/* Create form */}
      {showForm && (
        <WithdrawalForm loading={createM.isPending} onClose={() => setShowForm(false)} onSubmit={handleCreate}
          apiErrors={extractApiErrors(createM.error || {})} />
      )}

      {/* Edit form */}
      {editTarget && (
        <WithdrawalForm initial={editTarget} loading={updateM.isPending} onClose={() => setEdit(null)} onSubmit={handleEdit}
          apiErrors={extractApiErrors(updateM.error || {})} />
      )}

      {/* Detail / Communicate modal */}
      <Modal open={!!viewTarget} onClose={() => setView(null)} title="Withdrawal Ticket" size="lg">
        {viewTarget && (
          <DetailModal
            withdrawal={viewTarget}
            currentUserId={user?.id}
            canReview={canReview}
            initialTab={viewTarget.__openChat ? 'chat' : 'details'}
            onMarkClose={() => setClose(viewTarget)}
          />
        )}
      </Modal>

      {/* Upload slip */}
      <Modal open={!!slipTarget} onClose={() => setSlip(null)}
        title={`Upload Slip — ${slipTarget?.client_name ?? ''}`} size="sm">
        {slipTarget && <UploadSlipModal loading={uploadSlipM.isPending}
          apiErrors={extractApiErrors(uploadSlipM.error || {})}
          onClose={() => setSlip(null)}
          onSubmit={(fd) => uploadSlipM.mutate({ id: slipTarget.id, d: fd })} />}
      </Modal>

      {/* Not received */}
      <Modal open={!!notRcvdTarget} onClose={() => setNotR(null)}
        title="Client Did Not Receive Amount" size="sm">
        {notRcvdTarget && <NotReceivedModal loading={notRcvdM.isPending}
          apiErrors={extractApiErrors(notRcvdM.error || {})}
          onClose={() => setNotR(null)}
          onSubmit={(d) => notRcvdM.mutate({ id: notRcvdTarget.id, d })} />}
      </Modal>

      {/* Email sent */}
      <Modal open={!!emailTarget} onClose={() => setEmail(null)}
        title="Mark Email Sent to Bank" size="sm">
        {emailTarget && <EmailSentModal loading={emailSentM.isPending}
          apiErrors={extractApiErrors(emailSentM.error || {})}
          onClose={() => setEmail(null)}
          onSubmit={(d) => emailSentM.mutate({ id: emailTarget.id, d })} />}
      </Modal>

      {/* Manual close */}
      <Modal open={!!closeTarget} onClose={() => setClose(null)}
        title="Close Withdrawal Ticket" size="sm">
        {closeTarget && <ManualCloseModal withdrawal={closeTarget} loading={closeM.isPending}
          apiErrors={extractApiErrors(closeM.error || {})}
          onClose={() => setClose(null)}
          onSubmit={(d) => closeM.mutate({ id: closeTarget.id, d })} />}
      </Modal>

      {/* Confirm received */}
      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => setCfm(null)}
        onConfirm={() => confirmM.mutate(confirmTarget.id)}
        loading={confirmM.isPending}
        title="Confirm Client Received"
        message={`Has ${confirmTarget?.client_name ?? 'the client'} confirmed receipt of ₹${confirmTarget ? Number(confirmTarget.amount).toLocaleString('en-IN') : ''}? This will close the ticket.`}
      />

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
