import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Power, PowerOff } from 'lucide-react'
import { getGateways, createGateway, updateGateway, activateGateway, deactivateGateway } from '../api/master'
import Modal         from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'

// ── Form ──────────────────────────────────────────────────────────────────
function GatewayForm({ initial, onSubmit, loading, error }) {
  const [name, setName] = useState(initial?.name ?? '')

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit({ name }) }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Gateway Name *
        </label>
        <input
          className="input"
          placeholder="e.g. PG1"
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase())}
          required
          maxLength={50}
        />
        <p className="mt-1 text-xs text-gray-400">Name will be saved in uppercase.</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name.trim()}
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
  const [modal,     setModal]     = useState(null)   // { mode: 'create' | 'edit', data? }
  const [toggleTarget, setToggleTarget] = useState(null) // gateway to activate/deactivate

  const { data, isLoading } = useQuery({
    queryKey: ['master-gateways-all'],
    queryFn:  () => getGateways(),
  })

  // For the management page show ALL gateways (active + inactive) — fetch without filter
  // The API only returns active ones, so we manage via the admin page using activate/deactivate
  const gateways = data?.data?.data ?? []

  const inv = () => qc.invalidateQueries({ queryKey: ['master-gateways'] })
             + qc.invalidateQueries({ queryKey: ['master-gateways-all'] })

  const createM     = useMutation({ mutationFn: createGateway,                               onSuccess: () => { inv(); setModal(null) } })
  const updateM     = useMutation({ mutationFn: ({ id, d }) => updateGateway(id, d),         onSuccess: () => { inv(); setModal(null) } })
  const activateM   = useMutation({ mutationFn: activateGateway,                             onSuccess: () => { inv(); setToggleTarget(null) } })
  const deactivateM = useMutation({ mutationFn: deactivateGateway,                           onSuccess: () => { inv(); setToggleTarget(null) } })

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

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['#', 'Name', 'Status', 'Created', 'Actions'].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!isLoading && gateways.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No gateways yet. Click "Add Gateway" to create one.
                </td>
              </tr>
            )}
            {gateways.map((gw) => (
              <tr key={gw.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-400">{gw.id}</td>
                <td className="px-4 py-3">
                  <span className="bg-accent/10 text-accent-dark text-xs font-bold px-2.5 py-1 rounded-md">
                    {gw.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    gw.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {gw.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(gw.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={() => setModal({ mode: 'edit', data: gw })}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setToggleTarget(gw)}
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                        gw.is_active
                          ? 'bg-amber-50 text-amber-500 hover:bg-amber-100'
                          : 'bg-green-50 text-green-500 hover:bg-green-100'
                      }`}
                      title={gw.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {gw.is_active ? <PowerOff size={12} /> : <Power size={12} />}
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
          onSubmit={(vals) => createM.mutate(vals)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={modal?.mode === 'edit'} onClose={() => setModal(null)} title="Edit Gateway">
        <GatewayForm
          initial={modal?.data}
          loading={updateM.isPending}
          error={updateErr}
          onSubmit={(vals) => updateM.mutate({ id: modal.data.id, d: vals })}
        />
      </Modal>

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
