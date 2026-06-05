const STATUS_CONFIG = {
  healthy:   { bar: 'bg-green-500',  track: 'bg-green-100',  text: 'text-green-700',  label: 'Healthy'       },
  warning:   { bar: 'bg-amber-400',  track: 'bg-amber-100',  text: 'text-amber-600',  label: 'Warning'       },
  danger:    { bar: 'bg-red-500',    track: 'bg-red-100',    text: 'text-red-600',    label: 'Critical'      },
  exhausted: { bar: 'bg-red-600',    track: 'bg-red-100',    text: 'text-red-700',    label: 'Blocked (85%+)' },
}

const fmt = (v) => Number(v).toLocaleString('en-IN')

export default function CapacityBar({ capacity }) {
  if (!capacity || capacity.capacity_status === 'no_limit') {
    return <span className="text-[11px] text-gray-300 italic">No limit</span>
  }

  const { percent_used = 0, collected_today, remaining, daily_limit, capacity_status } = capacity
  const cfg = STATUS_CONFIG[capacity_status] ?? STATUS_CONFIG.healthy

  return (
    <div className="min-w-[150px] w-full">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
        <span className={`text-[11px] font-bold tabular-nums ${cfg.text}`}>{percent_used}%</span>
      </div>
      <div className={`w-full h-1.5 rounded-full ${cfg.track}`}>
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${cfg.bar}`}
          style={{ width: `${Math.min(100, percent_used)}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-gray-400">₹{fmt(collected_today)} used</span>
        <span className="text-[10px] text-gray-400">₹{fmt(daily_limit)} limit</span>
      </div>
    </div>
  )
}
