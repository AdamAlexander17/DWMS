import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Search, RefreshCw } from 'lucide-react'
import { getBrands, createBrand, updateBrand, deleteBrand, activateBrand, deactivateBrand } from '../api/brands'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'

function BrandForm({ initial, onSubmit, loading }) {
  const [name, setName] = useState(initial?.name ?? '')
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name }) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. TK" required />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
          {loading ? 'Saving…' : initial ? 'Update Brand' : 'Create Brand'}
        </button>
      </div>
    </form>
  )
}

export default function Brands() {
  const qc = useQueryClient()
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)   // null | {mode:'create'|'edit', data?}
  const [delTarget, setDelTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['brands', page, search],
    queryFn:  () => getBrands({ page, search }),
  })

  const brands     = data?.data?.data?.results ?? []
  const totalPages = data?.data?.data?.total_pages ?? 1
  const total      = data?.data?.data?.count ?? 0

  const invalidate = () => qc.invalidateQueries({ queryKey: ['brands'] })

  const createM  = useMutation({ mutationFn: createBrand,   onSuccess: () => { invalidate(); setModal(null) } })
  const updateM  = useMutation({ mutationFn: ({ id, d }) => updateBrand(id, d), onSuccess: () => { invalidate(); setModal(null) } })
  const deleteM  = useMutation({ mutationFn: deleteBrand,   onSuccess: () => { invalidate(); setDelTarget(null) } })
  const toggleM  = useMutation({ mutationFn: ({ id, active }) => active ? deactivateBrand(id) : activateBrand(id), onSuccess: invalidate })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Brands</h1>
          <p className="page-subtitle">{total} brand{total !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
          <Plus size={16} /> New Brand
        </button>
      </div>

      {/* Filter bar */}
      <div className="card py-4">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search brands…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-6 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Brand Name</th>
              <th className="px-6 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
              <th className="px-6 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Created</th>
              <th className="px-6 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {brands.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm">No brands found</td></tr>
            )}
            {brands.map((b, i) => (
              <tr key={b.id} className="hover:bg-amber-50/40 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent text-sidebar-bg flex items-center justify-center font-bold text-sm shrink-0">
                      {b.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-gray-800">{b.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4"><Badge variant={b.is_active ? 'active' : 'inactive'} /></td>
                <td className="px-6 py-4 text-gray-500">{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => toggleM.mutate({ id: b.id, active: b.is_active })}
                      title={b.is_active ? 'Deactivate' : 'Activate'}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${b.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    >
                      {b.is_active ? <CheckCircle size={15} /> : <XCircle size={15} />}
                    </button>
                    <button onClick={() => setModal({ mode: 'edit', data: b })} title="Edit" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDelTarget(b)} title="Delete" className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 pb-4">
          <Pagination current={page} total={totalPages} onPage={setPage} />
        </div>
      </div>

      {/* Create / Edit modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Brand' : 'New Brand'}>
        <BrandForm
          initial={modal?.data}
          loading={createM.isPending || updateM.isPending}
          onSubmit={(vals) => {
            if (modal?.mode === 'edit') updateM.mutate({ id: modal.data.id, d: vals })
            else createM.mutate(vals)
          }}
        />
        {(createM.isError || updateM.isError) && (
          <p className="text-red-500 text-sm mt-3">
            {createM.error?.response?.data?.message || updateM.error?.response?.data?.message || 'An error occurred'}
          </p>
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending}
        title="Delete Brand"
        message={`Delete brand "${delTarget?.name}"? This cannot be undone.`}
      />
    </div>
  )
}
