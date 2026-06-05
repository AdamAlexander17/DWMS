import { useState, useEffect, useRef } from 'react'
import { Bell, AlertTriangle, AlertOctagon, XCircle, CheckCheck } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getNotifications, getUnreadCount, markAllRead, markNotificationRead } from '../../api/deposits'

const LEVEL_CONFIG = {
  warning: {
    Icon: AlertTriangle,
    color: 'text-amber-500',
    bg:    'bg-amber-50',
    border:'border-amber-200',
    label: 'Warning — 50% reached',
  },
  danger: {
    Icon: AlertOctagon,
    color: 'text-red-500',
    bg:    'bg-red-50',
    border:'border-red-200',
    label: 'Critical — 80% reached',
  },
  exhausted: {
    Icon: XCircle,
    color: 'text-red-600',
    bg:    'bg-red-50',
    border:'border-red-200',
    label: 'Blocked — 85% daily limit reached',
  },
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
  const ref = useRef(null)
  const qc  = useQueryClient()

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: countData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn:  getUnreadCount,
    refetchInterval: 60_000,
  })
  const unread = countData?.data?.data?.count ?? 0

  const { data: notifData } = useQuery({
    queryKey: ['notifications-list'],
    queryFn:  () => getNotifications({ page_size: 20 }),
    enabled:  open,
  })
  const notifications = notifData?.data?.data?.results ?? []

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    qc.invalidateQueries({ queryKey: ['notifications-list'] })
  }

  const markReadM = useMutation({ mutationFn: markNotificationRead, onSuccess: inv })
  const markAllM  = useMutation({ mutationFn: markAllRead,          onSuccess: inv })

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-gray-500" />
              <p className="font-semibold text-gray-800 text-sm">Channel Alerts</p>
              {unread > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAllM.mutate()}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent-dark font-medium transition-colors"
              >
                <CheckCheck size={13} /> All read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-gray-400">No alerts</p>
            )}
            {notifications.map((n) => {
              const cfg  = LEVEL_CONFIG[n.level] ?? LEVEL_CONFIG.warning
              const Icon = cfg.Icon
              return (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markReadM.mutate(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-amber-50/40' : ''}`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                    <Icon size={15} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{n.channel_label}</p>
                    <p className="text-[11px] text-gray-500">{cfg.label}</p>
                    <p className="text-[11px] text-gray-400">{n.percent_used}% used · {timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <div className="shrink-0 w-2 h-2 rounded-full bg-accent self-start mt-2" />}
                </div>
              )
            })}
          </div>

          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-[10px] text-gray-400 text-center">Auto-refreshes every 60s</p>
          </div>
        </div>
      )}
    </div>
  )
}
