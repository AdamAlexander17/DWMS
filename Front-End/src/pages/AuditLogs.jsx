import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { getAuditLogs } from '../api/auditLogs'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'

const moduleColors = {
  Auth:  'bg-purple-50 text-purple-700 border-purple-200',
  User:  'bg-blue-50 text-blue-700 border-blue-200',
  Brand: 'bg-amber-50 text-amber-700 border-amber-200',
  'QR Code':       'bg-green-50 text-green-700 border-green-200',
  UPI:             'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Bank Account':  'bg-rose-50 text-rose-700 border-rose-200',
}

export default function AuditLogs() {
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, module],
    queryFn:  () => getAuditLogs({ page, search, module: module || undefined }),
  })

  const logs       = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Audit Logs</h1>
        <p className="page-subtitle">{total} log entr{total !== 1 ? 'ies' : 'y'}</p>
      </div>

      <div className="card py-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search action or user…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input max-w-[160px]" value={module} onChange={(e) => { setModule(e.target.value); setPage(1) }}>
          <option value="">All Modules</option>
          {Object.keys(moduleColors).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['Time', 'User', 'Module', 'Action', 'IP Address'].map((h) => (
                <th key={h} className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">No logs found</td></tr>}
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-gray-800">@{log.username || 'system'}</p>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${moduleColors[log.module] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                    {log.module}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-700">{log.action}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{log.ip_address || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-50"><Pagination current={page} total={totalPages} onPage={setPage} /></div>
      </div>
    </div>
  )
}
