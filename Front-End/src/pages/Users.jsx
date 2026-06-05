import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Search, LockKeyhole, X, Clock, Calendar, ChevronDown, ChevronUp, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, activateUser, deactivateUser, resetPassword, bulkImportUsers } from '../api/users'
import { getBrands } from '../api/brands'
import { getRoles } from '../api/roles'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'

function UserModal({ initial, brands, roles, onSubmit, onClose, loading }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    username: initial?.username ?? '',
    role:     String(initial?.role ?? ''),
    brands:   (initial?.brands ?? []).map(String),
    password: '123456',
  })

  const toggleBrand = (id) => {
    const sid = String(id)
    setForm(p => ({
      ...p,
      brands: p.brands.includes(sid) ? p.brands.filter(b => b !== sid) : [...p.brands, sid],
    }))
  }

  const roleLabel = (r) => r.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 rounded-t-2xl bg-accent">
          <div>
            <h2 className="text-base font-bold text-white">{isEdit ? 'Edit User' : 'Add User'}</h2>
            <p className="text-xs text-white/60 mt-0.5">
              {isEdit ? 'Update the details for this user account' : 'Fill in the details to create a new user account'}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors ml-4 mt-0.5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="px-6 py-5 space-y-5">

          {/* Username + Default Password */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                className="input"
                placeholder="Enter username"
                value={form.username}
                onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
                required
                disabled={isEdit}
              />
            </div>
            {!isEdit && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Default Password</label>
                <input className="input bg-gray-50 text-gray-500 cursor-not-allowed" value="123456" readOnly />
              </div>
            )}
          </div>
          {!isEdit && (
            <p className="text-xs text-gray-400 -mt-3">
              New users are created with password 123456 and must change it on first login.
            </p>
          )}

          {/* Brands */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-200">
              Brands <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {brands.map(b => {
                const sel = form.brands.includes(String(b.id))
                return (
                  <button
                    key={b.id} type="button"
                    onClick={() => toggleBrand(b.id)}
                    className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-all
                      ${sel
                        ? 'bg-accent text-white border-accent shadow-sm'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-accent hover:text-accent'
                      }`}
                  >
                    {b.name}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              The new user will only see data belonging to the selected brand(s).
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 pb-2 border-b border-gray-200">
              Role <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {roles.map(r => {
                const sel = String(form.role) === String(r.id)
                return (
                  <button
                    key={r.id} type="button"
                    onClick={() => setForm(p => ({ ...p, role: String(r.id) }))}
                    className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-all
                      ${sel
                        ? 'bg-accent text-white border-accent shadow-sm'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-accent hover:text-accent'
                      }`}
                  >
                    {roleLabel(r)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <button
              type="button" onClick={onClose}
              className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : isEdit ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BulkImportModal({ onClose, onSuccess }) {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const inputRef = useRef()

  const SAMPLE_CSV = 'username,role,brands,password\njohn_doe,rm,"Trade Karo,Trade Bazaar",123456\njane_smith,back_office,BazaarFx,123456'

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'sample_users.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await bulkImportUsers(file)
      setResult(res.data?.data)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 rounded-t-2xl bg-accent">
          <div>
            <h2 className="text-base font-bold text-white">Bulk Import Users</h2>
            <p className="text-xs text-white/60 mt-0.5">Upload a CSV or Excel file to create multiple users at once</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors ml-4 mt-0.5"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Download sample */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <FileSpreadsheet size={16} />
              <span>Download sample CSV template</span>
            </div>
            <button onClick={downloadSample} className="text-xs font-semibold text-accent hover:underline">Download</button>
          </div>

          {/* Column guide */}
          <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 space-y-0.5">
            <p className="font-semibold text-gray-600 mb-1">Required columns:</p>
            <p><span className="font-medium text-gray-700">username</span> — unique username</p>
            <p><span className="font-medium text-gray-700">role</span> — admin / back_office / rm</p>
            <p><span className="font-medium text-gray-700">brands</span> — comma-separated brand names (optional)</p>
            <p><span className="font-medium text-gray-700">password</span> — defaults to 123456 if empty</p>
          </div>

          {/* File picker */}
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-accent/50 hover:bg-blue-50/30 transition-colors"
          >
            <Upload size={24} className="mx-auto text-gray-300 mb-2" />
            {file
              ? <p className="text-sm font-semibold text-accent">{file.name}</p>
              : <p className="text-sm text-gray-400">Click to choose a <span className="font-semibold">.csv</span> or <span className="font-semibold">.xlsx</span> file</p>
            }
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); setError(null) }} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
              <AlertCircle size={14} />{error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="rounded-xl border border-gray-100 overflow-hidden text-sm">
              <div className="bg-gray-50 px-4 py-2 font-semibold text-gray-600 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-green-500" /> {result.summary}
              </div>
              {result.errors?.length > 0 && (
                <div className="px-4 py-2 space-y-1 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-red-500 text-xs">Row {e.row}{e.username ? ` (${e.username})` : ''}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button onClick={onClose} className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button onClick={handleUpload} disabled={!file || loading} className="btn-primary">
                {loading ? 'Uploading…' : 'Import Users'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ResetPwForm({ onSubmit, loading }) {
  const [pw, setPw] = useState('')
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(pw) }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
        <input type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
        {loading ? 'Resetting…' : 'Reset Password'}
      </button>
    </form>
  )
}

export default function Users() {
  const qc = useQueryClient()
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [sortAsc, setSortAsc] = useState(false)
  const [modal, setModal]   = useState(null)
  const [delTarget, setDelTarget]   = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const AVATAR_COLORS = ['bg-teal-500','bg-blue-600','bg-indigo-500','bg-violet-500','bg-cyan-600','bg-sky-600','bg-emerald-600','bg-blue-500']
  const avatarColor = (name) => AVATAR_COLORS[name.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length]

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—'

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter, sortAsc],
    queryFn:  () => getUsers({ page, search, role: roleFilter || undefined, ordering: sortAsc ? 'created_at' : '-created_at' }),
  })
  const { data: brandsData } = useQuery({ queryKey: ['brands-all'], queryFn: () => getBrands({ page_size: 100 }) })
  const { data: rolesData }  = useQuery({ queryKey: ['roles-all'],  queryFn: () => getRoles({ is_active: true }) })

  const users  = data?.data?.data?.results ?? []
  const total  = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1
  const brands = brandsData?.data?.data?.results ?? brandsData?.data?.results ?? []
  const roles  = rolesData?.data?.data?.results ?? []

  const inv = () => qc.invalidateQueries({ queryKey: ['users'] })

  const buildPayload = (form) => {
    const d = { ...form }
    // send brands as array of integers; omit if empty
    d.brands = (d.brands ?? []).map(Number).filter(Boolean)
    if (!d.brands.length) delete d.brands
    if (!d.role) delete d.role
    return d
  }

  const createM = useMutation({ mutationFn: (d) => createUser(buildPayload(d)), onSuccess: () => { inv(); setModal(null) } })
  const updateM = useMutation({ mutationFn: ({ id, d }) => updateUser(id, buildPayload(d)), onSuccess: () => { inv(); setModal(null) } })
  const deleteM = useMutation({ mutationFn: deleteUser, onSuccess: () => { inv(); setDelTarget(null) } })
  const toggleM = useMutation({ mutationFn: ({ id, active }) => active ? deactivateUser(id) : activateUser(id), onSuccess: inv })
  const resetM  = useMutation({ mutationFn: ({ id, pw }) => resetPassword(id, pw), onSuccess: () => { setResetTarget(null) } })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{total} user{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-1.5">
            <Upload size={15} /> Import
          </button>
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus size={16} /> New User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card py-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search users…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input max-w-[180px]" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}>
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
              {['User', 'Brand', 'Roles', 'Status', 'Last Login'].map((h) => (
                <th key={h} className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider">{h}</th>
              ))}
              <th
                className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider cursor-pointer select-none"
                onClick={() => setSortAsc(p => !p)}
              >
                <span className="inline-flex items-center gap-1">
                  Created {sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </span>
              </th>
              <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">No users found</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-blue-50/20 transition-colors">

                {/* User */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${avatarColor(u.username)} flex items-center justify-center font-bold text-white text-xs shrink-0`}>
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800 text-xs leading-tight">{u.username}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">@{u.username}</p>
                    </div>
                  </div>
                </td>

                {/* Brand */}
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {u.brands_detail?.length ? u.brands_detail.map(b => b.name).join(', ') : <span className="text-gray-300">—</span>}
                </td>

                {/* Roles */}
                <td className="px-4 py-2.5"><Badge variant={u.role_name} /></td>

                {/* Status — toggle switch */}
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleM.mutate({ id: u.id, active: u.is_active })}
                    title={u.is_active ? 'Deactivate' : 'Activate'}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${u.is_active ? 'bg-accent' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${u.is_active ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </td>

                {/* Last Login */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                    <Clock size={11} className="text-gray-300 shrink-0" />
                    {fmtDateTime(u.last_login)}
                  </div>
                </td>

                {/* Created */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                    <Calendar size={11} className="text-gray-300 shrink-0" />
                    {fmtDate(u.created_at)}
                  </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => setResetTarget(u)} title="Reset Password" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><LockKeyhole size={13} /></button>
                    <button onClick={() => setModal({ mode: 'edit', data: u })} title="Edit" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => setDelTarget(u)} title="Delete" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-50">
          <Pagination current={page} total={totalPages} onPage={setPage} />
        </div>
      </div>

      {showImport && (
        <BulkImportModal onClose={() => setShowImport(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['users'] }) }} />
      )}

      {!!modal && (        <UserModal
          initial={modal?.data}
          brands={brands}
          roles={roles}
          loading={createM.isPending || updateM.isPending}
          onClose={() => setModal(null)}
          onSubmit={(vals) => modal?.mode === 'edit' ? updateM.mutate({ id: modal.data.id, d: vals }) : createM.mutate(vals)}
        />
      )}
      {(createM.isError || updateM.isError) && null}

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset Password — ${resetTarget?.username}`} size="sm">
        <ResetPwForm loading={resetM.isPending} onSubmit={(pw) => resetM.mutate({ id: resetTarget.id, pw })} />
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending} title="Delete User" message={`Delete user "${delTarget?.username}"? This cannot be undone.`} />
    </div>
  )
}
