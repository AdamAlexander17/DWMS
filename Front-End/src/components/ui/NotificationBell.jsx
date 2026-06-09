import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, AlertTriangle, AlertOctagon, XCircle, CheckCheck,
  FileText, Mail, CheckCircle2, ArrowDownCircle, ArrowUpCircle,
  MessageCircle, Lock, X, Trash2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications, getUnreadCount, markAllRead, markNotificationRead,
  deleteNotification, clearAllNotifications,
} from '../../api/deposits'
import {
  getWdNotifications, getWdUnreadCount, markWdAllRead, markWdNotifRead,
  deleteWdNotif, clearAllWdNotifs,
} from '../../api/withdrawals'
import { connectWS } from '../../api/ws'
import { useAuthStore } from '../../store/authStore'

// ── Notification chime (Web Audio API — no audio file needed) ─────────────
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const notes = [880, 1100]   // A5 → C#6  (bright two-tone ding)
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4)
      osc.start(start)
      osc.stop(start + 0.4)
    })
  } catch { /* browser blocked audio — silently ignore */ }
}

// Deposit-channel alert level
const DEPOSIT_CFG = {
  warning:   { Icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50',  border: 'border-amber-200', label: 'Warning — 50% reached'   },
  danger:    { Icon: AlertOctagon,  color: 'text-red-500',   bg: 'bg-red-50',   border: 'border-red-200',   label: 'Critical — 80% reached'  },
  exhausted: { Icon: XCircle,       color: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',   label: 'Blocked — 85% reached'   },
  info:      { Icon: ArrowDownCircle, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200',  label: 'Deposit Update'           },
}

// Withdrawal-ticket notification type
const WD_CFG = {
  slip_uploaded:      { Icon: FileText,       color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200',   label: 'Slip Uploaded' },
  followup_required:  { Icon: AlertTriangle,  color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    label: 'Bank Follow-Up Required' },
  email_sent_to_bank: { Icon: Mail,           color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', label: 'Email Sent to Bank' },
  closed:             { Icon: CheckCircle2,   color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-200',  label: 'Ticket Closed' },
  new_message:        { Icon: MessageCircle,  color: 'text-accent',     bg: 'bg-blue-50',   border: 'border-blue-200',   label: 'New Message' },
  manual_closed:      { Icon: Lock,           color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200',   label: 'Ticket Closed' },
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [tab,  setTab]  = useState('withdrawals')   // 'withdrawals' | 'deposits'
  const [wsLive, setWsLive] = useState(false)
  const ref         = useRef(null)
  const navigate     = useNavigate()
  const qc           = useQueryClient()
  const { accessToken } = useAuthStore()
  const prevDepUnread = useRef(0)
  const prevWdUnread  = useRef(0)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Deposit alerts ────────────────────────────────────────────────────────
  const { data: depCount } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn:  getUnreadCount,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const depUnread = depCount?.data?.data?.count ?? 0

  // Chime when deposit unread count goes up
  useEffect(() => {
    if (depUnread > prevDepUnread.current) playChime()
    prevDepUnread.current = depUnread
  }, [depUnread])

  const { data: depList } = useQuery({
    queryKey: ['notifications-list'],
    queryFn:  () => getNotifications({ page_size: 50 }),
    enabled:  open && tab === 'deposits',
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const depNotifs = depList?.data?.data?.results ?? []

  // ── Withdrawal alerts ─────────────────────────────────────────────────────
  const { data: wdCount } = useQuery({
    queryKey: ['wd-notifications-unread'],
    queryFn:  getWdUnreadCount,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })
  const wdUnread = wdCount?.data?.data?.count ?? 0

  // Chime when WD unread count goes up (safety-net for polling path)
  useEffect(() => {
    if (wdUnread > prevWdUnread.current) playChime()
    prevWdUnread.current = wdUnread
  }, [wdUnread])

  const { data: wdList } = useQuery({
    queryKey: ['wd-notifications-list'],
    queryFn:  getWdNotifications,
    enabled:  open && tab === 'withdrawals',
  })
  const wdNotifs = wdList?.data?.data ?? []

  // Live WS push for withdrawal notifications
  useEffect(() => {
    if (!accessToken) return
    const conn = connectWS('/ws/notifications/', accessToken, {
      onOpen:  () => setWsLive(true),
      onClose: () => setWsLive(false),
      onMessage: (data) => {
        if (data?.type === 'notification' && data.notification) {
          playChime()   // ← real-time WS push
          // prepend new notification to cached list
          qc.setQueryData(['wd-notifications-list'], (prev) => {
            if (!prev) return prev
            const list = prev.data?.data ?? []
            if (list.some(n => n.id === data.notification.id)) return prev
            return { ...prev, data: { ...prev.data, data: [data.notification, ...list].slice(0, 50) } }
          })
          qc.setQueryData(['wd-notifications-unread'], (prev) => {
            if (!prev) return prev
            return { ...prev, data: { ...prev.data, data: { count: data.unread_count ?? 0 } } }
          })
          // also refresh ticket list / stats so badges update
          qc.invalidateQueries({ queryKey: ['withdrawals'] })
          qc.invalidateQueries({ queryKey: ['withdrawal-stats'] })
        }
        if (data?.type === 'deposit_update') {
          playChime()   // ← deposit create / edit / review push
          // Force refetch instead of injecting a stub — the server returns full row
          qc.invalidateQueries({ queryKey: ['notifications-list'] })
          qc.invalidateQueries({ queryKey: ['notifications-unread'] })
          // live-refresh deposit tables on both sides
          qc.invalidateQueries({ queryKey: ['deposits'] })
          qc.invalidateQueries({ queryKey: ['deposit-history'] })
        }
        if (data?.type === 'unread_count') {
          qc.setQueryData(['wd-notifications-unread'], (prev) => {
            if (!prev) return prev
            return { ...prev, data: { ...prev.data, data: { count: data.unread_count ?? 0 } } }
          })
        }
      },
    })
    return () => conn.close()
  }, [accessToken, qc])

  const totalUnread = depUnread + wdUnread

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    qc.invalidateQueries({ queryKey: ['notifications-list'] })
    qc.invalidateQueries({ queryKey: ['wd-notifications-unread'] })
    qc.invalidateQueries({ queryKey: ['wd-notifications-list'] })
  }

  const depReadM    = useMutation({ mutationFn: markNotificationRead, onSuccess: inv })
  const depReadAllM = useMutation({ mutationFn: markAllRead,          onSuccess: inv })
  const wdReadM     = useMutation({ mutationFn: markWdNotifRead,      onSuccess: inv })
  const wdReadAllM  = useMutation({ mutationFn: markWdAllRead,        onSuccess: inv })
  const wdDelM      = useMutation({
    mutationFn: deleteWdNotif,
    onMutate: async (id) => {
      // optimistic remove
      qc.setQueryData(['wd-notifications-list'], (prev) => {
        if (!prev) return prev
        const list = (prev.data?.data ?? []).filter(n => n.id !== id)
        return { ...prev, data: { ...prev.data, data: list } }
      })
    },
    onSuccess: inv,
  })
  const wdClearAllM = useMutation({
    mutationFn: clearAllWdNotifs,
    onMutate: () => {
      qc.setQueryData(['wd-notifications-list'], (prev) => {
        if (!prev) return prev
        return { ...prev, data: { ...prev.data, data: [] } }
      })
    },
    onSuccess: inv,
  })
  const depDelM = useMutation({
    mutationFn: deleteNotification,
    onMutate: async (id) => {
      qc.setQueryData(['notifications-list'], (prev) => {
        if (!prev) return prev
        const list = (prev.data?.data?.results ?? []).filter(n => n.id !== id)
        return { ...prev, data: { ...prev.data, data: { ...prev.data.data, results: list } } }
      })
    },
    onSuccess: inv,
  })
  const depClearAllM = useMutation({
    mutationFn: clearAllNotifications,
    onMutate: () => {
      qc.setQueryData(['notifications-list'], (prev) => {
        if (!prev) return prev
        return { ...prev, data: { ...prev.data, data: { ...prev.data.data, results: [], count: 0 } } }
      })
    },
    onSuccess: inv,
  })

  const handleWdClick = (n) => {
    if (!n.is_read) wdReadM.mutate(n.id)
    setOpen(false)
    // Deep-link directly to this ticket's chat tab
    if (n.withdrawal_id) {
      navigate(`/withdrawals?ticket=${n.withdrawal_id}&chat=1`)
    } else {
      navigate('/withdrawals')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center px-1 leading-none animate-pulse">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-gray-500" />
              <p className="font-semibold text-gray-800 text-sm">Notifications</p>
              {totalUnread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalUnread}</span>
              )}
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                wsLive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${wsLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                {wsLive ? 'LIVE' : 'OFF'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {((tab === 'deposits'    && depUnread > 0) ||
                (tab === 'withdrawals' && wdUnread  > 0)) && (
                <button
                  onClick={() => tab === 'deposits' ? depReadAllM.mutate() : wdReadAllM.mutate()}
                  title="Mark all as read"
                  className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-dark font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-accent/5"
                >
                  <CheckCheck size={13} /> Read all
                </button>
              )}
              {tab === 'withdrawals' && wdNotifs.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Clear all withdrawal notifications? This cannot be undone.')) {
                      wdClearAllM.mutate()
                    }
                  }}
                  title="Clear all notifications"
                  className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
              {tab === 'deposits' && depNotifs.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Clear all channel notifications? This cannot be undone.')) {
                      depClearAllM.mutate()
                    }
                  }}
                  title="Clear all notifications"
                  className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-medium transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => setTab('withdrawals')}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                tab === 'withdrawals' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowUpCircle size={13} /> Withdrawals
              {wdUnread > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{wdUnread}</span>
              )}
            </button>
            <button
              onClick={() => setTab('deposits')}
              className={`flex-1 px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                tab === 'deposits' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ArrowDownCircle size={13} /> Channels
              {depUnread > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">{depUnread}</span>
              )}
            </button>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">

            {/* Withdrawal notifications */}
            {tab === 'withdrawals' && (
              <>
                {wdNotifs.length === 0 && (
                  <p className="px-4 py-10 text-center text-sm text-gray-400">No withdrawal alerts</p>
                )}
                {wdNotifs.map((n) => {
                  const cfg  = WD_CFG[n.notif_type] ?? WD_CFG.slip_uploaded
                  const Icon = cfg.Icon
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleWdClick(n)}
                      className={`group relative flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                        <Icon size={15} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                        <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {n.withdrawal_client} · {timeAgo(n.created_at)}
                        </p>
                      </div>
                      {!n.is_read && <div className="shrink-0 w-2 h-2 rounded-full bg-accent self-start mt-2" />}
                      <button
                        onClick={(e) => { e.stopPropagation(); wdDelM.mutate(n.id) }}
                        title="Dismiss"
                        className="absolute top-2 right-2 w-5 h-5 rounded-full text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
              </>
            )}

            {/* Deposit channel alerts */}
            {tab === 'deposits' && (
              <>
                {depNotifs.length === 0 && (
                  <p className="px-4 py-10 text-center text-sm text-gray-400">No channel alerts</p>
                )}
                {depNotifs.map((n) => {
                  const cfg  = DEPOSIT_CFG[n.level] ?? DEPOSIT_CFG.info
                  const Icon = cfg.Icon
                  const isStatusUpdate = n.level === 'info'
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && depReadM.mutate(n.id)}
                      className={`group relative flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                        <Icon size={15} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                        <p className="text-xs text-gray-700 mt-0.5 line-clamp-2">{n.message}</p>
                        {!isStatusUpdate && n.percent_used != null && (
                          <p className="text-[11px] text-gray-400">{n.percent_used}% used · {timeAgo(n.created_at)}</p>
                        )}
                        {(isStatusUpdate || n.percent_used == null) && (
                          <p className="text-[11px] text-gray-400">{timeAgo(n.created_at)}</p>
                        )}
                      </div>
                      {!n.is_read && <div className="shrink-0 w-2 h-2 rounded-full bg-accent self-start mt-2" />}
                      <button
                        onClick={(e) => { e.stopPropagation(); depDelM.mutate(n.id) }}
                        title="Dismiss"
                        className="absolute top-2 right-2 w-5 h-5 rounded-full text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-[10px] text-gray-400 text-center">
              {wsLive ? 'Live — instant updates over WebSocket' : 'Reconnecting…'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
