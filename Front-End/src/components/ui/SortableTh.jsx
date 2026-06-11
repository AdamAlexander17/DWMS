/**
 * SortableTh — a single clickable <th> that shows the current sort direction.
 *
 * Props:
 *   label    — string displayed in the header
 *   sortKey  — the key string passed to toggle/icon
 *   toggle   — from useSortable
 *   icon     — from useSortable
 *   left     — boolean, left-align text (default: false = center)
 *   className — extra Tailwind classes
 */
export default function SortableTh({ label, sortKey, toggle, icon, left = false, className = '' }) {
  return (
    <th
      onClick={() => toggle(sortKey)}
      title={`Sort by ${label}`}
      className={[
        'px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none',
        left ? 'text-left' : 'text-center',
        className,
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[10px] text-gray-400">{icon(sortKey)}</span>
      </span>
    </th>
  )
}
