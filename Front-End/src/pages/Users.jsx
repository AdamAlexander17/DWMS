import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Search, KeyRound } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, activateUser, deactivateUser, resetPassword } from '../api/users'
import { getBrands } from '../api/brands'
import { getRoles } from '../api/roles'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'

function UserForm({ initial, brands, roles, onSubmit, loading }) {
  const [form, setForm] = useState({
    username:  initial?.username  ?? '',
    role:      initial?.role      ?? '',
    brands:    (initial?.brands ?? []).map(String),
    password:  '',
  })
  const isEdit = !!initial
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))

  const selectedRole = roles.find((r) => String(r.id) === String(form.role))
  const isRM = selectedRole?.name?.toLowerCase() === 'rm'

  const toggleBrand = (id) => {
    const sid = String(id)
    setForm((p) => ({
      ...p,
      brands: p.brands.map(String).includes(sid)
        ? p.brands.filter((b) => String(b) !== sid)
        : [...p.brands, sid],
    }))
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
          <input className="input" value={form.username} onChange={(e) => f('username')(e.target.value)} required disabled={isEdit} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
          <select className="input" value={form.role} onChange={(e) => f('role')(e.target.value)}>
            <option value="">— Select Role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Brands multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Brands {isRM ? <span className="text-red-500">*</span> : <span className="text-gray-400 text-xs">(optional)</span>}
        </label>
        {brands.length === 0 ? (
          <p className="text-sm text-gray-400">No brands available</p>
        ) : (
          <div className="border border-gray-300 rounded-lg p-3 grid grid-cols-2 gap-y-2 gap-x-4 max-h-40 overflow-y-auto">
            {brands.map((b) => {
              const checked = form.brands.map(String).includes(String(b.id))
              return (
                <label key={b.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBrand(b.id)}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className={checked ? 'text-gray-800 font-medium' : 'text-gray-500'}>{b.name}</span>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {!isEdit && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
          <input type="password" className="input" value={form.password} onChange={(e) => f('password')(e.target.value)} required />
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
        {loading ? 'Saving…' : isEdit ? 'Update User' : 'Create User'}
      </button>
    </form>
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
  const [modal, setModal]   = useState(null)
  const [delTarget, setDelTarget]   = useState(null)
  const [resetTarget, setResetTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter],
    queryFn:  () => getUsers({ page, search, role: roleFilter || undefined }),
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
        <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
          <Plus size={16} /> New User
        </button>
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['#', 'User', 'Role', 'Brand', 'Status', 'Actions'].map((h) => (
                <th key={h} className={`px-6 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No users found</td></tr>
            )}
            {users.map((u, i) => (
              <tr key={u.id} className="hover:bg-amber-50/40 transition-colors">
                <td className="px-6 py-4 text-gray-400 text-xs">{(page-1)*20+i+1}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm shrink-0">
                      {u.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">@{u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><Badge variant={u.role_name} /></td>
                <td className="px-6 py-4 text-gray-500 text-sm">
                  {u.brands_detail?.length
                    ? u.brands_detail.map((b) => b.name).join(', ')
                    : '—'}
                </td>
                <td className="px-6 py-4"><Badge variant={u.is_active ? 'active' : 'inactive'} /></td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => toggleM.mutate({ id: u.id, active: u.is_active })} title={u.is_active ? 'Deactivate' : 'Activate'}
                      className={`p-1.5 rounded-lg ${u.is_active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                      {u.is_active ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    </button>
                    <button onClick={() => setResetTarget(u)} title="Reset Password" className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50"><KeyRound size={15} /></button>
                    <button onClick={() => setModal({ mode: 'edit', data: u })} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50"><Pencil size={15} /></button>
                    <button onClick={() => setDelTarget(u)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={15} /></button>
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

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit User' : 'New User'} size="lg">
        <UserForm initial={modal?.data} brands={brands} roles={roles} loading={createM.isPending || updateM.isPending}
          onSubmit={(vals) => modal?.mode === 'edit' ? updateM.mutate({ id: modal.data.id, d: vals }) : createM.mutate(vals)} />
        {(createM.isError || updateM.isError) && (
          <p className="text-red-500 text-sm mt-3">
            {JSON.stringify(createM.error?.response?.data?.errors || updateM.error?.response?.data?.errors || 'Error')}
          </p>
        )}
      </Modal>

      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset Password — ${resetTarget?.username}`} size="sm">
        <ResetPwForm loading={resetM.isPending} onSubmit={(pw) => resetM.mutate({ id: resetTarget.id, pw })} />
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending} title="Delete User" message={`Delete user "${delTarget?.username}"? This cannot be undone.`} />
    </div>
  )
}
