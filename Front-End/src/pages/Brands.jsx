import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, SquarePen, Trash2, Power, PowerOff, Search, RefreshCw } from 'lucide-react'
import { getBrands, createBrand, updateBrand, deleteBrand, activateBrand, deactivateBrand } from '../api/brands'
import { useAuthStore } from '../store/authStore'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import SortableTh    from '../components/ui/SortableTh'
import { useSortable } from '../hooks/useSortable'
import { PageSpinner } from '../components/ui/Spinner'
import FormField from '../components/ui/FormField'
import { brandName as vBrandName, extractApiErrors } from '../utils/validators'

function BrandForm({ initial, onSubmit, loading, apiErrors = {} }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [error, setError] = useState(null)

  // Surface server-side error if it arrives
  const nameError = error || apiErrors.name

  const handleSubmit = (e) => {
    e.preventDefault()
    const err = vBrandName(name)
    if (err) { setError(err); return }
    setError(null)
    onSubmit({ name: name.toUpperCase().trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Brand Name" required error={nameError} hint="2–50 uppercase characters (letters, digits, space, _ or -).">
        <input
          className={`input ${nameError ? 'border-red-300' : ''}`}
          value={name}
          onChange={(e) => { setName(e.target.value.toUpperCase()); if (error) setError(null) }}
          placeholder="e.g. TK"
          maxLength={50}
        />
      </FormField>
      {apiErrors.non_field && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{apiErrors.non_field}</div>
      )}
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
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canCreate   = hasPermission('brands', 'create')
  const canEdit     = hasPermission('brands', 'edit')
  const canDelete   = hasPermission('brands', 'delete')
  const canActivate = hasPermission('brands', 'activate')

  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [search, setSearch]     = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [modal, setModal]       = useState(null)   // null | {mode:'create'|'edit', data?}
  const [delTarget, setDelTarget] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['brands', page, pageSize],
    queryFn:  () => getBrands({ page, page_size: pageSize, search: debouncedSearch }),
  })

  useEffect(() => {
    refetch()
  }, [debouncedSearch, refetch])

  const brands     = data?.data?.data?.results ?? []
  const totalPages = data?.data?.data?.total_pages ?? 1
  const total      = data?.data?.data?.count ?? 0

  const getBrandVal = (b, key) => {
    if (key === 'name')       return (b.name ?? '').toLowerCase()
    if (key === 'status')     return b.is_active ? 1 : 0
    if (key === 'created_at') return b.created_at ? new Date(b.created_at).getTime() : 0
    return ''
  }
  const { sorted: sortedBrands, toggle: toggleSort, icon: sortIcon } =
    useSortable(brands, getBrandVal, 'created_at', 'desc')

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
        {canCreate && (
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus size={16} /> New Brand
          </button>
        )}
      </div>

      {/* Filter + Pagination bar */}
      <div className="card py-4 flex items-center justify-between gap-3">
        <div className="relative w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search brands…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="shrink-0">
          <Pagination current={page} total={totalPages} onPage={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(1) }} />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-center">
              <SortableTh label="Brand Name" sortKey="name"       toggle={toggleSort} icon={sortIcon} left />
              <SortableTh label="Status"     sortKey="status"     toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Created"    sortKey="created_at" toggle={toggleSort} icon={sortIcon} />
              {(canEdit || canDelete || canActivate) && (
                <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {brands.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400 text-sm">No brands found</td></tr>
            )}
            {sortedBrands.map((b, i) => (
              <tr key={b.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent text-sidebar-bg flex items-center justify-center font-bold text-sm shrink-0">
                      {b.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-gray-800">{b.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-center"><Badge variant={b.is_active ? 'active' : 'inactive'} /></td>
                <td className="px-4 py-2.5 text-gray-500 text-xs text-center">{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 justify-end">
                    {canActivate && (
                      <button
                        onClick={() => toggleM.mutate({ id: b.id, active: b.is_active })}
                        title={b.is_active ? 'Deactivate' : 'Activate'}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors"
                      >
                        {b.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                      </button>
                    )}
                    {canEdit && (
                      <button onClick={() => setModal({ mode: 'edit', data: b })} title="Edit" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <SquarePen size={12} />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDelTarget(b)} title="Delete" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Brand' : 'New Brand'}>
        <BrandForm
          initial={modal?.data}
          loading={createM.isPending || updateM.isPending}
          apiErrors={extractApiErrors(createM.error || updateM.error || {})}
          onSubmit={(vals) => {
            if (modal?.mode === 'edit') updateM.mutate({ id: modal.data.id, d: vals })
            else createM.mutate(vals)
          }}
        />
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
