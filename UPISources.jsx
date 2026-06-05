import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Search } from 'lucide-react'
import { getUPISources, createUPISource, updateUPISource, deleteUPISource, activateUPISource, deactivateUPISource } from '../api/payments'
import { getBrands } from '../api/brands'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import CapacityBar from '../components/ui/CapacityBar'
import { useAuthStore } from '../store/authStore'

function UPIForm({ initial, brands, onSubmit, loading }) {
  const [form, setForm] = useState({
    upi_id:      initial?.upi_id      ?? '',
    brand:       initial?.brand       ?? '',
    range_from:  initial?.range_from  ?? '',
    range_to:    initial?.range_to    ?? '',
    daily_limit: initial?.daily_limit ?? '',
  })
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">UPI ID *</label>
        <input className="input" value={form.upi_id} onChange={(e) => f('upi_id')(e.target.value)} placeholder="e.g. merchant@upi" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand *</label>
        <select className="input" value={form.brand} onChange={(e) => f('brand')(e.target.value)} required>
          <option value="">Select brand</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Range From *</label>
          <input type="number" className="input" value={form.range_from} onChange={(e) => f('range_from')(e.target.value)} required step="0.01" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Range To *</label>
          <input type="number" className="input" value={form.range_to} onChange={(e) => f('range_to')(e.target.value)} required step="0.01" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Limit (₹) <span className="text-gray-400 font-normal">— optional</span></label>
        <input type="number" className="input" placeholder="e.g. 100000" value={form.daily_limit} onChange={(e) => f('daily_limit')(e.target.value)} step="0.01" min="0" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
        {loading ? 'Saving…' : initial ? 'Update UPI Source' : 'Create UPI Source'}
      </button>
    </form>
  )
}

export default function UPISources() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canWrite = ['admin', 'back_office'].includes(user?.role)
  const [page, setPage]  = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['upi-sources', page, search],
    queryFn:  () => getUPISources({ page, search }),
  })
  const { data: brandsData } = useQuery({ queryKey: ['brands-all'], queryFn: () => getBrands({ page_size: 100 }) })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1
  const brands     = brandsData?.data?.data?.results ?? []

  const inv    = () => qc.invalidateQueries({ queryKey: ['upi-sources'] })
  const createM = useMutation({ mutationFn: createUPISource,              onSuccess: () => { inv(); setModal(null) } })
  const updateM = useMutation({ mutationFn: ({ id, d }) => updateUPISource(id, d), onSuccess: () => { inv(); setModal(null) } })
  const deleteM = useMutation({ mutationFn: deleteUPISource,              onSuccess: () => { inv(); setDelTarget(null) } })
  const toggleM = useMutation({ mutationFn: ({ id, a }) => a ? deactivateUPISource(id) : activateUPISource(id), onSuccess: inv })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">UPI Sources</h1>
          <p className="page-subtitle">{total} UPI source{total !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && <button onClick={() => setModal({ mode: 'create' })} className="btn-primary"><Plus size={16} /> New UPI</button>}
      </div>

      <div className="card py-4">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search UPI IDs…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['UPI ID', 'Brand', 'Range', 'Daily Capacity', 'Status', ...(canWrite ? ['Actions'] : [])].map((h) => (
                <th key={h} className={`px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">No UPI sources found</td></tr>}
            {records.map((r, i) => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-2.5 font-mono font-medium text-gray-800 text-xs">{r.upi_id}</td>
                <td className="px-4 py-2.5">
                  <span className="bg-accent/10 text-accent-dark text-xs font-bold px-2 py-0.5 rounded-md">{r.brand_name}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">₹{r.range_from} – ₹{r.range_to}</td>
                <td className="px-4 py-2.5"><CapacityBar capacity={r.capacity} /></td>
                <td className="px-4 py-2.5"><Badge variant={r.is_active ? 'active' : 'inactive'} /></td>
                {canWrite && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => toggleM.mutate({ id: r.id, a: r.is_active })} title={r.is_active ? 'Deactivate' : 'Activate'} className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${r.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                        {r.is_active ? <CheckCircle size={13} /> : <XCircle size={13} />}
                      </button>
                      <button onClick={() => setModal({ mode: 'edit', data: r })} title="Edit" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => setDelTarget(r)} title="Delete" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-50"><Pagination current={page} total={totalPages} onPage={setPage} /></div>
      </div>

      {canWrite && (
        <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit UPI Source' : 'New UPI Source'}>
          <UPIForm initial={modal?.data} brands={brands} loading={createM.isPending || updateM.isPending}
            onSubmit={(vals) => modal?.mode === 'edit' ? updateM.mutate({ id: modal.data.id, d: vals }) : createM.mutate(vals)} />
          {(createM.isError || updateM.isError) && (
            <p className="text-red-500 text-sm mt-3">{createM.error?.response?.data?.message || updateM.error?.response?.data?.message || 'Error'}</p>
          )}
        </Modal>
      )}

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending} title="Delete UPI Source" message={`Delete UPI "${delTarget?.upi_id}"?`} />
    </div>
  )
}
