import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, SquarePen, Trash2, Power, PowerOff, Search } from 'lucide-react'
import { getUPISources, createUPISource, updateUPISource, deleteUPISource, activateUPISource, deactivateUPISource } from '../api/payments'
import { getBrands } from '../api/brands'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import SortableTh    from '../components/ui/SortableTh'
import { useSortable } from '../hooks/useSortable'
import { PageSpinner } from '../components/ui/Spinner'
import CapacityBar from '../components/ui/CapacityBar'
import { useAuthStore } from '../store/authStore'
import { upi as vUpi, positiveAmount as vAmt, rangeOrder, extractApiErrors } from '../utils/validators'

function UPIForm({ initial, brands, onSubmit, loading, apiErrors = {} }) {
  const [form, setForm] = useState({
    upi_id:      initial?.upi_id      ?? '',
    brand:       initial?.brand       ?? '',
    range_from:  initial?.range_from  ?? '',
    range_to:    initial?.range_to    ?? '',
    daily_limit: initial?.daily_limit ?? '',
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); if (local[k]) setLocal(p => ({ ...p, [k]: undefined })) }
  const E = (k) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>
  const cls = (k) => `input ${errors[k] ? 'border-red-300' : ''}`

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    const u  = vUpi(form.upi_id);                                    if (u)  errs.upi_id = u
    if (!form.brand) errs.brand = 'Please select a brand.'
    const rf = vAmt(form.range_from, { label: 'Range From' });       if (rf) errs.range_from = rf
    const rt = vAmt(form.range_to,   { label: 'Range To' });         if (rt) errs.range_to   = rt
    const rorder = rangeOrder(form.range_from, form.range_to, 'Range To'); if (rorder) errs.range_to = rorder
    if (form.daily_limit !== '' && form.daily_limit !== null) {
      const dl = vAmt(form.daily_limit, { label: 'Daily Limit' });
      if (dl) errs.daily_limit = dl
      else if (form.range_to && Number(form.daily_limit) < Number(form.range_to)) {
        errs.daily_limit = 'Daily limit must be ≥ Range To.'
      }
    }
    setLocal(errs)
    if (Object.keys(errs).length === 0) {
      onSubmit({ ...form, upi_id: form.upi_id.toLowerCase().trim() })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">UPI ID *</label>
        <input
          className={cls('upi_id')}
          value={form.upi_id}
          onChange={(e) => f('upi_id')(e.target.value.toLowerCase())}
          placeholder="e.g. merchant@upi"
          maxLength={100}
        />
        {E('upi_id')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand *</label>
        <select className={cls('brand')} value={form.brand} onChange={(e) => f('brand')(e.target.value)}>
          <option value="">Select brand</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {E('brand')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Range From *</label>
          <input type="number" className={cls('range_from')} value={form.range_from} onChange={(e) => f('range_from')(e.target.value)} step="0.01" min="0" />
          {E('range_from')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Range To *</label>
          <input type="number" className={cls('range_to')} value={form.range_to} onChange={(e) => f('range_to')(e.target.value)} step="0.01" min="0" />
          {E('range_to')}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Limit (₹) <span className="text-gray-400 font-normal">— optional</span></label>
        <input type="number" className={cls('daily_limit')} placeholder="e.g. 100000" value={form.daily_limit} onChange={(e) => f('daily_limit')(e.target.value)} step="0.01" min="0" />
        {E('daily_limit')}
      </div>
      {errors.non_field && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{errors.non_field}</div>
      )}
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
  const [pageSize, setPageSize] = useState(100)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['upi-sources', page, pageSize, debouncedSearch],
    queryFn:  () => getUPISources({ page, page_size: pageSize, search: debouncedSearch }),
    placeholderData: keepPreviousData,
  })
  const { data: brandsData } = useQuery({ queryKey: ['brands-all'], queryFn: () => getBrands({ page_size: 100 }) })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1
  const allBrands  = brandsData?.data?.data?.results ?? []
  const brands     = user?.role === 'admin'
    ? allBrands
    : allBrands.filter(b => (user?.brand_ids ?? []).includes(b.id))

  const getUpiVal = (r, key) => {
    if (key === 'upi_id')    return (r.upi_id ?? '').toLowerCase()
    if (key === 'brand')     return (r.brand_name ?? '').toLowerCase()
    if (key === 'range')     return Number(r.range_from ?? 0)
    if (key === 'capacity')  return Number(r.capacity?.used_today ?? 0)
    if (key === 'status')    return r.is_active ? 1 : 0
    return ''
  }
  const { sorted: sortedRecords, toggle: toggleSort, icon: sortIcon } =
    useSortable(records, getUpiVal, 'upi_id', 'asc')

  const inv      = () => qc.invalidateQueries({ queryKey: ['upi-sources'] })
  const resetView = () => { setSearch(''); setPage(1) }
  const createM = useMutation({ mutationFn: createUPISource,              onSuccess: () => { resetView(); inv(); setModal(null) } })
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

      <div className="card py-4 flex items-center justify-between gap-3">
        <div className="relative w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search UPI IDs…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="shrink-0">
          <Pagination current={page} total={totalPages} onPage={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(1) }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-center">
              <SortableTh label="UPI ID"         sortKey="upi_id"   toggle={toggleSort} icon={sortIcon} left />
              <SortableTh label="Brand"          sortKey="brand"    toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Range"          sortKey="range"    toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Daily Capacity" sortKey="capacity" toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Status"         sortKey="status"   toggle={toggleSort} icon={sortIcon} />
              {canWrite && <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && <tr><td colSpan={canWrite ? 6 : 5} className="px-4 py-10 text-center text-gray-400 text-sm">No UPI sources found</td></tr>}
            {sortedRecords.map((r, i) => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-2.5 font-mono font-medium text-gray-800 text-xs">{r.upi_id}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className="inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-accent/10 text-accent-dark border-accent/20 whitespace-nowrap">{r.brand_name}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs text-center">₹{r.range_from} – ₹{r.range_to}</td>
                <td className="px-4 py-2.5 text-center"><CapacityBar capacity={r.capacity} /></td>
                <td className="px-4 py-2.5 text-center"><Badge variant={r.is_active ? 'active' : 'inactive'} /></td>
                {canWrite && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => toggleM.mutate({ id: r.id, a: r.is_active })} title={r.is_active ? 'Deactivate' : 'Activate'} className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors">
                        {r.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                      </button>
                      <button onClick={() => setModal({ mode: 'edit', data: r })} title="Edit" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"><SquarePen size={12} /></button>
                      <button onClick={() => setDelTarget(r)} title="Delete" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canWrite && (
        <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit UPI Source' : 'New UPI Source'}>
          <UPIForm
            initial={modal?.data}
            brands={brands}
            loading={createM.isPending || updateM.isPending}
            apiErrors={extractApiErrors(createM.error || updateM.error || {})}
            onSubmit={(vals) => modal?.mode === 'edit' ? updateM.mutate({ id: modal.data.id, d: vals }) : createM.mutate(vals)}
          />
        </Modal>
      )}

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending} title="Delete UPI Source" message={`Delete UPI "${delTarget?.upi_id}"?`} />
    </div>
  )
}
