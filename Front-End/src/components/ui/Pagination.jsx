import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ current, total, onPage }) {
  if (total <= 1) return null
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  const visible = pages.filter((p) => p === 1 || p === total || Math.abs(p - current) <= 1)

  let prev = null
  return (
    <div className="flex items-center gap-1 mt-4 justify-end">
      <button
        onClick={() => onPage(current - 1)}
        disabled={current === 1}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronLeft size={16} />
      </button>
      {visible.map((p) => {
        const gap = prev !== null && p - prev > 1
        prev = p
        return (
          <span key={p} className="flex items-center gap-1">
            {gap && <span className="px-1 text-gray-400 text-sm">…</span>}
            <button
              onClick={() => onPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                p === current
                  ? 'bg-accent text-sidebar-bg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          </span>
        )
      })}
      <button
        onClick={() => onPage(current + 1)}
        disabled={current === total}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
