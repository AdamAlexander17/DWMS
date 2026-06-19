import { useState, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { getAuditLogs } from '../api/auditLogs'
import Pagination    from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'

const moduleColors = {
  Auth:           'bg-purple-50 text-purple-700 border-purple-200',
  User:           'bg-blue-50 text-blue-700 border-blue-200',
  Brand:          'bg-amber-50 text-amber-700 border-amber-200',
  roles:          'bg-indigo-50 text-indigo-700 border-indigo-200',
  Withdrawal:     'bg-pink-50 text-pink-700 border-pink-200',
  Deposit:        'bg-teal-50 text-teal-700 border-teal-200',
  'QR Code':      'bg-green-50 text-green-700 border-green-200',
  UPI:            'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Bank Account': 'bg-rose-50 text-rose-700 border-rose-200',
}

// Map frontend sort keys to backend ordering fields
const SORT_KEY_MAP = {
  timestamp:  'timestamp',
  user:       'user__username',
  module:     'module',
  action:     'action',
  ip_address: 'ip_address',
}

export default function AuditLogs() {
  const [page, setPage]       = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch]   = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [module, setModule]   = useState('')
  const [sortBy, setSortBy]   = useState('timestamp')
  const [sortDir, setSortDir] = useState('desc')

  // Debounce search — 400ms after last keystroke
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const ordering = sortBy
    ? `${sortDir === 'desc' ? '-' : ''}${SORT_KEY_MAP[sortBy] || sortBy}`
    : '-timestamp'

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, pageSize, debouncedSearch, module, ordering],
    queryFn:  () => getAuditLogs({
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
      module: module || undefined,
      ordering,
    }),
    placeholderData: keepPreviousData,
  })

  const logs       = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const sortIcon = (key) => {
    if (sortBy !== key) return <ChevronsUpDown size={12} className="text-gray-300" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-accent" />
      : <ChevronDown size={12} className="text-accent" />
  }

  if (isLoading && !data) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Audit Logs</h1>
        <p className="page-subtitle">{total} log entr{total !== 1 ? 'ies' : 'y'}</p>
      </div>

      <div className="card py-4 flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-[320px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Search action, module, user…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input max-w-[160px]" value={module} onChange={(e) => { setModule(e.target.value); setPage(1) }}>
            <option value="">All Modules</option>
            {Object.keys(moduleColors).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="shrink-0">
          <Pagination current={page} total={totalPages} onPage={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(1) }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-center">
              {[
                { key: 'timestamp',  label: 'Time',       left: true },
                { key: 'user',       label: 'User'       },
                { key: 'module',     label: 'Module'     },
                { key: 'action',     label: 'Action'     },
                { key: 'ip_address', label: 'IP Address' },
              ].map(({ key, label, left }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className={`px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 transition-colors ${left ? 'text-left' : 'text-center'}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {label} {sortIcon(key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">No logs found</td></tr>}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <p className="font-medium text-gray-800">@{log.username || 'system'}</p>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${moduleColors[log.module] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {log.module}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-700 text-center">{log.action}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500 text-center">{log.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
