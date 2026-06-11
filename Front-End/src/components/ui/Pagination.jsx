import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  current,
  total,
  onPage,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 500],
}) {
  if (total <= 1 && !onPageSizeChange) return null

  return (
    <div className="flex items-center justify-end gap-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Rows</span>
        {onPageSizeChange ? (
          <select
            className="input h-9 py-1.5 px-2.5 min-w-[84px]"
            value={String(pageSize ?? pageSizeOptions[0])}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <span className="text-gray-700 font-medium">{pageSize ?? '-'}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(current - 1)}
          disabled={current <= 1}
          className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
          title="Previous page"
        >
          <ChevronLeft size={16} className="mx-auto" />
        </button>

        <div className="h-8 min-w-[72px] rounded-lg border border-gray-200 bg-white px-3 flex items-center justify-center text-sm font-semibold text-gray-700">
          {current}
          <span className="mx-1 text-gray-400">/</span>
          <span className="text-gray-500">{total || 1}</span>
        </div>

        <button
          onClick={() => onPage(current + 1)}
          disabled={current >= total}
          className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
          title="Next page"
        >
          <ChevronRight size={16} className="mx-auto" />
        </button>
      </div>
    </div>
  )
}
