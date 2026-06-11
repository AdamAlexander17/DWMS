import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, SquarePen, Trash2, Power, PowerOff, Search, QrCode as QrIcon, MoreVertical, X, Download, Maximize2 } from 'lucide-react'
import { getQRCodes, createQRCode, updateQRCode, deleteQRCode, activateQRCode, deactivateQRCode } from '../api/payments'
import { getBrands } from '../api/brands'
import Modal         from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Pagination    from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import CapacityBar   from '../components/ui/CapacityBar'
import { useAuthStore } from '../store/authStore'
import { positiveAmount, rangeOrder as vRangeOrder, extractApiErrors } from '../utils/validators'

const vFromAmt = (v, label = 'Amount') => positiveAmount(v, { label })

// ── Download helper ───────────────────────────────────────────────────────
async function downloadQR(imageUrl, fileName) {
  try {
    const res  = await fetch(imageUrl)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${fileName}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    window.location.href = imageUrl
  }
}

// ── Three-dot dropdown menu ────────────────────────────────────────────────
function CardMenu({ record, onEdit, onDelete, onToggle }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-200 shadow-lg z-20 overflow-hidden py-1">
          <button
            onClick={() => { onToggle(record); setOpen(false) }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-amber-50 text-amber-600`}
          >
            {record.is_active ? <PowerOff size={14} /> : <Power size={14} />}
            {record.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => { onEdit(record); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <SquarePen size={14} className="text-teal-600" /> Edit
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => { onDelete(record); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Image preview lightbox ────────────────────────────────────────────────
function ImageLightbox({ src, name, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/30"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl p-4 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-sm truncate">{name}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <img src={src} alt={name} className="w-full rounded-lg object-contain" />
      </div>
    </div>
  )
}

// ── Single QR card ─────────────────────────────────────────────────────────
function QRCard({ r, canWrite, onEdit, onDelete, onToggle }) {
  const [preview, setPreview] = useState(false)
  return (
    <>
    {preview && <ImageLightbox src={r.qr_image} name={r.qr_name} onClose={() => setPreview(false)} />}
    <div className="bg-white rounded-xl border border-gray-200 shadow-card flex flex-col overflow-hidden hover:shadow-card-hover transition-shadow duration-200">
      {/* Image area */}
      <div className="relative h-44 bg-gray-50 flex items-center justify-center p-4 border-b border-gray-100">
        {r.qr_image
          ? <img src={r.qr_image} alt={r.qr_name} className="h-full w-full object-contain" />
          : <QrIcon size={72} className="text-gray-200" />
        }
        {/* Status */}
        <span className={`absolute top-3 left-3 px-2.5 py-0.5 text-[11px] font-bold rounded-full ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
        {/* View full image */}
        {r.qr_image && (
          <button
            onClick={() => setPreview(true)}
            className="absolute top-3 right-3 p-1.5 bg-white rounded-lg border border-gray-200 text-gray-400 hover:text-accent transition-colors shadow-sm">
            <Maximize2 size={13} />
          </button>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Name + brand + menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">{r.qr_name}</h3>
            <span className="inline-block mt-1.5 bg-accent/10 text-accent text-[11px] font-bold px-2 py-0.5 rounded-md">
              {r.brand_name}
            </span>
          </div>
          {canWrite && <CardMenu record={r} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />}
        </div>

        {/* Range */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Range</p>
          <p className="text-xs text-gray-600 font-medium">
            ₹{Number(r.range_from).toLocaleString('en-IN')} – ₹{Number(r.range_to).toLocaleString('en-IN')}
          </p>
        </div>

        {/* Daily capacity */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Daily Capacity</p>
          <CapacityBar capacity={r.capacity} />
        </div>

        {/* Download button */}
        {r.qr_image ? (
          <button
            onClick={() => downloadQR(r.qr_image, r.qr_name)}
            className="mt-auto w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all duration-150"
          >
            <Download size={14} /> Download QR
          </button>
        ) : (
          <div className="mt-auto w-full py-2 rounded-lg border border-dashed border-gray-200 text-xs text-center text-gray-300">
            No image uploaded
          </div>
        )}
      </div>
    </div>
    </>
  )
}

// ── Create / Edit form ─────────────────────────────────────────────────────
function QRForm({ initial, brands, onSubmit, loading, apiErrors = {} }) {
  const [form, setForm] = useState({
    qr_name:     initial?.qr_name     ?? '',
    brand:       initial?.brand       ?? '',
    range_from:  initial?.range_from  ?? '',
    range_to:    initial?.range_to    ?? '',
    daily_limit: initial?.daily_limit ?? '',
    qr_image:    null,
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); if (local[k]) setLocal(p => ({ ...p, [k]: undefined })) }
  const E = (k) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>
  const cls = (k) => `input ${errors[k] ? 'border-red-300' : ''}`
  const isEdit = !!initial

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.qr_name?.trim()) errs.qr_name = 'QR name is required.'
    else if (form.qr_name.length > 100) errs.qr_name = 'QR name must be at most 100 characters.'
    if (!form.brand) errs.brand = 'Please select a brand.'
    if (!isEdit && !form.qr_image) errs.qr_image = 'QR image is required.'
    if (form.qr_image) {
      const file = form.qr_image
      const sizeMB = file.size / (1024 * 1024)
      if (sizeMB > 5) errs.qr_image = `Image is ${sizeMB.toFixed(1)} MB — must be ≤ 5 MB.`
      else if (!/\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(file.name)) {
        errs.qr_image = 'Image must be JPG, PNG, WebP, GIF, BMP, or TIFF.'
      }
    }
    if (vFromAmt(form.range_from, 'Range From')) errs.range_from = vFromAmt(form.range_from, 'Range From')
    if (vFromAmt(form.range_to, 'Range To'))     errs.range_to   = vFromAmt(form.range_to, 'Range To')
    if (!errs.range_from && !errs.range_to) {
      const r = vRangeOrder(form.range_from, form.range_to, 'Range To'); if (r) errs.range_to = r
    }
    if (form.daily_limit !== '' && form.daily_limit !== null) {
      const dl = vFromAmt(form.daily_limit, 'Daily Limit'); if (dl) errs.daily_limit = dl
      else if (form.range_to && Number(form.daily_limit) < Number(form.range_to)) {
        errs.daily_limit = 'Daily limit must be ≥ Range To.'
      }
    }
    setLocal(errs)
    if (Object.keys(errs).length === 0) onSubmit({ ...form, qr_name: form.qr_name.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">QR Name *</label>
        <input className={cls('qr_name')} value={form.qr_name} onChange={(e) => f('qr_name')(e.target.value)} maxLength={100} />
        {E('qr_name')}
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">QR Image {isEdit ? '(leave blank to keep)' : '*'}</label>
        <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,image/*" className={`${cls('qr_image')} py-1.5`} onChange={(e) => f('qr_image')(e.target.files[0] || null)} />
        <p className="text-xs text-gray-400 mt-1">Max 5 MB. JPG/PNG/WebP/GIF/BMP/TIFF.</p>
        {E('qr_image')}
      </div>
      {errors.non_field && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{errors.non_field}</div>
      )}
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
        {loading ? 'Saving…' : isEdit ? 'Update QR Code' : 'Upload QR Code'}
      </button>
    </form>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function QRCodes() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canWrite = ['admin', 'back_office'].includes(user?.role)
  const [page,      setPage]      = useState(1)
  const [pageSize,  setPageSize]  = useState(100)
  const [search,    setSearch]    = useState('')
  const [modal,     setModal]     = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['qr-codes', page, pageSize, search],
    queryFn:  () => getQRCodes({ page, page_size: pageSize, search }),
  })
  const { data: brandsData } = useQuery({ queryKey: ['brands-all'], queryFn: () => getBrands({ page_size: 100 }) })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1
  const allBrands  = brandsData?.data?.data?.results ?? []
  const brands     = user?.role === 'admin'
    ? allBrands
    : allBrands.filter(b => (user?.brand_ids ?? []).includes(b.id))

  const inv     = () => qc.invalidateQueries({ queryKey: ['qr-codes'] })
  const resetView = () => { setSearch(''); setPage(1) }
  const clean   = (form) => { const d = { ...form }; if (!d.qr_image) delete d.qr_image; return d }

  const createM = useMutation({ mutationFn: createQRCode,                                    onSuccess: () => { resetView(); inv(); setModal(null) } })
  const updateM = useMutation({ mutationFn: ({ id, d }) => updateQRCode(id, clean(d)),       onSuccess: () => { inv(); setModal(null) } })
  const deleteM = useMutation({ mutationFn: deleteQRCode,                                    onSuccess: () => { inv(); setDelTarget(null) } })
  const toggleM = useMutation({ mutationFn: ({ id, a }) => a ? deactivateQRCode(id) : activateQRCode(id), onSuccess: inv })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">QR Codes</h1>
          <p className="page-subtitle">{total} QR code{total !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && (
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus size={16} /> Upload QR
          </button>
        )}
      </div>

      {/* Global Search */}
      <div className="card py-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search QR codes by name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
      </div>

      {/* Pagination */}
      <div className="card py-3">
        <Pagination current={page} total={totalPages} onPage={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(1) }} />
      </div>

      {/* Cards grid — 4 per row on xl, scales down */}
      {records.length === 0 ? (
        <div className="card py-16 text-center text-gray-400">No QR codes found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {records.map((r) => (
            <QRCard
              key={r.id}
              r={r}
              canWrite={canWrite}
              onEdit={(rec) => setModal({ mode: 'edit', data: rec })}
              onDelete={(rec) => setDelTarget(rec)}
              onToggle={(rec) => toggleM.mutate({ id: rec.id, a: rec.is_active })}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {canWrite && (
        <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit QR Code' : 'Upload QR Code'}>
          <QRForm
            initial={modal?.data}
            brands={brands}
            loading={createM.isPending || updateM.isPending}
            apiErrors={extractApiErrors(createM.error || updateM.error || {})}
            onSubmit={(vals) => modal?.mode === 'edit' ? updateM.mutate({ id: modal.data.id, d: vals }) : createM.mutate(vals)}
          />
        </Modal>
      )}

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => setDelTarget(null)}
        onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending}
        title="Delete QR Code"
        message={`Delete "${delTarget?.qr_name}"? This cannot be undone.`}
      />
    </div>
  )
}
