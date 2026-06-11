import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, SquarePen, Trash2, Power, PowerOff, Search } from 'lucide-react'
import { getGateways, createGateway, updateGateway, activateGateway, deactivateGateway, deleteGateway } from '../api/master'
import Modal         from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import SortableTh    from '../components/ui/SortableTh'
import { useSortable } from '../hooks/useSortable'
import { brandName as vBrandName, extractApiErrors } from '../utils/validators'

// ── Form ──────────────────────────────────────────────────────────────────
function GatewayForm({ initial, onSubmit, loading, error, apiErrors = {} }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }

  const handleSubmit = (e) => {
    e.preventDefault()
    const nameErr = vBrandName(name)
    if (nameErr) { setLocal({ name: nameErr }); return }
    setLocal({})
    onSubmit({ name: name.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Gateway Name <span className="text-red-500">*</span>
        </label>
        <input
          className={`input ${errors.name ? 'border-red-300' : ''}`}
          placeholder="e.g. PG1"
          value={name}
          onChange={(e) => { setName(e.target.value.toUpperCase()); if (local.name) setLocal({}) }}
          maxLength={50}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        <p className="mt-1 text-xs text-gray-400">2–50 characters. Letters, digits, space, &amp; - _ allowed. Saved in uppercase.</p>
      </div>

      {(error || errors.non_field) && <p className="text-red-500 text-sm">{errors.non_field || error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center"
      >
        {loading ? 'Saving…' : initial ? 'Save Changes' : 'Add Gateway'}
      </button>
    </form>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Gateways() {
  const qc = useQueryClient()
  const [modal,     setModal]     = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [delTarget,    setDelTarget]    = useState(null)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['master-gateways-all'],
    queryFn:  () => getGateways(),
  })

  // For the management page show ALL gateways (active + inactive) — fetch without filter
  // The API only returns active ones, so we manage via the admin page using activate/deactivate
  const gateways = data?.data?.data ?? []
  const filtered  = search.trim()
    ? gateways.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
    : gateways

  const getGwVal = (row, key) => {
    if (key === 'name')       return (row.name ?? '').toLowerCase()
    if (key === 'status')     return row.is_active ? 1 : 0
    if (key === 'created_at') return row.created_at ? new Date(row.created_at).getTime() : 0
    return ''
  }
  const { sorted: sortedGateways, toggle: toggleSort, icon: sortIcon } =
    useSortable(filtered, getGwVal, 'created_at', 'desc')

  const inv = () => qc.invalidateQueries({ queryKey: ['master-gateways'] })
             + qc.invalidateQueries({ queryKey: ['master-gateways-all'] })

  const createM     = useMutation({ mutationFn: createGateway,                               onSuccess: () => { inv(); setModal(null) } })
  const updateM     = useMutation({ mutationFn: ({ id, d }) => updateGateway(id, d),         onSuccess: () => { inv(); setModal(null) } })
  const activateM   = useMutation({ mutationFn: activateGateway,                             onSuccess: () => { inv(); setToggleTarget(null) } })
  const deactivateM = useMutation({ mutationFn: deactivateGateway,                           onSuccess: () => { inv(); setToggleTarget(null) } })
  const deleteM     = useMutation({ mutationFn: deleteGateway,                                onSuccess: () => { inv(); setDelTarget(null) } })

  const createErr = createM.error?.response?.data?.message || (createM.isError ? 'Failed to create gateway.' : null)
  const updateErr = updateM.error?.response?.data?.message || (updateM.isError ? 'Failed to update gateway.' : null)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Gateways</h1>
          <p className="page-subtitle">{gateways.length} gateway{gateways.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
          <Plus size={16} /> Add Gateway
        </button>
      </div>

      {/* Search bar */}
      <div className="card py-3 px-4">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search gateway name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-center">
              <SortableTh label="Name"    sortKey="name"       toggle={toggleSort} icon={sortIcon} left />
              <SortableTh label="Status"  sortKey="status"     toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Created" sortKey="created_at" toggle={toggleSort} icon={sortIcon} />
              <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {search ? 'No gateways match your search.' : 'No gateways yet. Click "Add Gateway" to create one.'}
                </td>
              </tr>
            )}
            {sortedGateways.map((gw) => (
              <tr key={gw.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-accent/10 text-accent-dark border-accent/20 whitespace-nowrap">
                    {gw.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${
                    gw.is_active
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {gw.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 text-center">
                  {new Date(gw.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => setModal({ mode: 'edit', data: gw })}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      title="Edit"
                    >
                      <SquarePen size={12} />
                    </button>
                    <button
                      onClick={() => setToggleTarget(gw)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors"
                      title={gw.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {gw.is_active ? <PowerOff size={12} /> : <Power size={12} />}
                    </button>
                    <button
                      onClick={() => setDelTarget(gw)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal open={modal?.mode === 'create'} onClose={() => setModal(null)} title="Add Gateway">
        <GatewayForm
          loading={createM.isPending}
          error={createErr}
          apiErrors={extractApiErrors(createM.error || {})}
          onSubmit={(vals) => createM.mutate(vals)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={modal?.mode === 'edit'} onClose={() => setModal(null)} title="Edit Gateway">
        <GatewayForm
          initial={modal?.data}
          loading={updateM.isPending}
          error={updateErr}
          apiErrors={extractApiErrors(updateM.error || {})}
          onSubmit={(vals) => updateM.mutate({ id: modal.data.id, d: vals })}
        />
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending}
        title="Delete Gateway"
        message={`Delete "${delTarget?.name}"? This action cannot be undone.`}
      />

      {/* Activate / Deactivate Confirm */}
      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() =>
          toggleTarget?.is_active
            ? deactivateM.mutate(toggleTarget.id)
            : activateM.mutate(toggleTarget.id)
        }
        loading={activateM.isPending || deactivateM.isPending}
        title={toggleTarget?.is_active ? 'Deactivate Gateway' : 'Activate Gateway'}
        message={
          toggleTarget?.is_active
            ? `Deactivate "${toggleTarget?.name}"? It will no longer appear in the deposit gateway dropdown.`
            : `Activate "${toggleTarget?.name}"? It will become available in the deposit gateway dropdown.`
        }
      />
    </div>
  )
}
