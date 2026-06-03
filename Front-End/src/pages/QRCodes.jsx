import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Search, Image } from 'lucide-react'
import { getQRCodes, createQRCode, updateQRCode, deleteQRCode, activateQRCode, deactivateQRCode } from '../api/payments'
import { getBrands } from '../api/brands'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'

function QRForm({ initial, brands, onSubmit, loading }) {
  const [form, setForm] = useState({
    qr_name:    initial?.qr_name    ?? '',
    brand:      initial?.brand      ?? '',
    range_from: initial?.range_from ?? '',
    range_to:   initial?.range_to   ?? '',
    qr_image:   null,
  })
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))
  const isEdit = !!initial

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">QR Name *</label>
        <input className="input" value={form.qr_name} onChange={(e) => f('qr_name')(e.target.value)} required />
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
        <label className="block text-sm font-medium text-gray-700 mb-1.5">QR Image {isEdit ? '(leave blank to keep)' : '*'}</label>
        <input type="file" accept="image/*" className="input py-1.5" onChange={(e) => f('qr_image')(e.target.files[0] || null)} required={!isEdit} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
        {loading ? 'Saving…' : isEdit ? 'Update QR Code' : 'Upload QR Code'}
      </button>
    </form>
  )
}

export default function QRCodes() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canWrite = ['admin', 'back_office'].includes(user?.role)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['qr-codes', page, search],
    queryFn:  () => getQRCodes({ page, search }),
  })
  const { data: brandsData } = useQuery({ queryKey: ['brands-all'], queryFn: () => getBrands({ page_size: 100 }) })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1
  const brands     = brandsData?.data?.data?.results ?? []

  const inv    = () => qc.invalidateQueries({ queryKey: ['qr-codes'] })
  const clean  = (form) => { const d = { ...form }; if (!d.qr_image) delete d.qr_image; return d }

  const createM = useMutation({ mutationFn: createQRCode, onSuccess: () => { inv(); setModal(null) } })
  const updateM = useMutation({ mutationFn: ({ id, d }) => updateQRCode(id, clean(d)), onSuccess: () => { inv(); setModal(null) } })
  const deleteM = useMutation({ mutationFn: deleteQRCode, onSuccess: () => { inv(); setDelTarget(null) } })
  const toggleM = useMutation({ mutationFn: ({ id, a }) => a ? deactivateQRCode(id) : activateQRCode(id), onSuccess: inv })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">QR Codes</h1>
          <p className="page-subtitle">{total} QR code{total !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && <button onClick={() => setModal({ mode: 'create' })} className="btn-primary"><Plus size={16} /> Upload QR</button>}
      </div>

      <div className="card py-4">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search QR codes…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['#', 'QR Name', 'Brand', 'Range', 'Image', 'Status', ...(canWrite ? ['Actions'] : [])].map((h) => (
                <th key={h} className={`px-6 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No QR codes found</td></tr>}
            {records.map((r, i) => (
              <tr key={r.id} className="hover:bg-amber-50/40 transition-colors">
                <td className="px-6 py-4 text-gray-400 text-xs">{(page-1)*20+i+1}</td>
                <td className="px-6 py-4 font-semibold text-gray-800">{r.qr_name}</td>
                <td className="px-6 py-4">
                  <span className="bg-accent/10 text-accent-dark text-xs font-bold px-2 py-0.5 rounded-md">{r.brand_name}</span>
                </td>
                <td className="px-6 py-4 text-gray-500 text-xs">₹{r.range_from} – ₹{r.range_to}</td>
                <td className="px-6 py-4">
                  {r.qr_image
                    ? <a href={r.qr_image} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-600 flex items-center gap-1 text-xs"><Image size={13} />View</a>
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-6 py-4"><Badge variant={r.is_active ? 'active' : 'inactive'} /></td>
                {canWrite && (
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => toggleM.mutate({ id: r.id, a: r.is_active })} className={`p-1.5 rounded-lg ${r.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                        {r.is_active ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      </button>
                      <button onClick={() => setModal({ mode: 'edit', data: r })} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50"><Pencil size={15} /></button>
                      <button onClick={() => setDelTarget(r)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={15} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 pb-4"><Pagination current={page} total={totalPages} onPage={setPage} /></div>
      </div>

      {canWrite && (
        <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit QR Code' : 'Upload QR Code'}>
          <QRForm initial={modal?.data} brands={brands} loading={createM.isPending || updateM.isPending}
            onSubmit={(vals) => modal?.mode === 'edit' ? updateM.mutate({ id: modal.data.id, d: vals }) : createM.mutate(vals)} />
          {(createM.isError || updateM.isError) && (
            <p className="text-red-500 text-sm mt-3">{createM.error?.response?.data?.message || updateM.error?.response?.data?.message || 'Error'}</p>
          )}
        </Modal>
      )}

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending} title="Delete QR Code" message={`Delete "${delTarget?.qr_name}"?`} />
    </div>
  )
}
