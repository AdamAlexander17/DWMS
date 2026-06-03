import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Search } from 'lucide-react'
import { getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount, activateBankAccount, deactivateBankAccount } from '../api/payments'
import { getBrands } from '../api/brands'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import { useAuthStore } from '../store/authStore'

function BankForm({ initial, brands, onSubmit, loading }) {
  const [form, setForm] = useState({
    bank_name:            initial?.bank_name            ?? '',
    account_holder_name:  initial?.account_holder_name  ?? '',
    account_number:       initial?.account_number       ?? '',
    ifsc_code:            initial?.ifsc_code            ?? '',
    branch_name:          initial?.branch_name          ?? '',
    brand:                initial?.brand                ?? '',
    range_from:           initial?.range_from           ?? '',
    range_to:             initial?.range_to             ?? '',
  })
  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }))
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name *</label>
          <input className="input" value={form.bank_name} onChange={(e) => f('bank_name')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand *</label>
          <select className="input" value={form.brand} onChange={(e) => f('brand')(e.target.value)} required>
            <option value="">Select brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Holder *</label>
          <input className="input" value={form.account_holder_name} onChange={(e) => f('account_holder_name')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number *</label>
          <input className="input" value={form.account_number} onChange={(e) => f('account_number')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">IFSC Code *</label>
          <input className="input" value={form.ifsc_code} onChange={(e) => f('ifsc_code')(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch Name</label>
          <input className="input" value={form.branch_name} onChange={(e) => f('branch_name')(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Range From *</label>
          <input type="number" className="input" value={form.range_from} onChange={(e) => f('range_from')(e.target.value)} required step="0.01" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Range To *</label>
          <input type="number" className="input" value={form.range_to} onChange={(e) => f('range_to')(e.target.value)} required step="0.01" />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
        {loading ? 'Saving…' : initial ? 'Update Bank Account' : 'Add Bank Account'}
      </button>
    </form>
  )
}

export default function BankAccounts() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const canWrite = ['admin', 'back_office'].includes(user?.role)
  const [page, setPage]  = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['bank-accounts', page, search],
    queryFn:  () => getBankAccounts({ page, search }),
  })
  const { data: brandsData } = useQuery({ queryKey: ['brands-all'], queryFn: () => getBrands({ page_size: 100 }) })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1
  const brands     = brandsData?.data?.data?.results ?? []

  const inv    = () => qc.invalidateQueries({ queryKey: ['bank-accounts'] })
  const createM = useMutation({ mutationFn: createBankAccount,                  onSuccess: () => { inv(); setModal(null) } })
  const updateM = useMutation({ mutationFn: ({ id, d }) => updateBankAccount(id, d), onSuccess: () => { inv(); setModal(null) } })
  const deleteM = useMutation({ mutationFn: deleteBankAccount,                  onSuccess: () => { inv(); setDelTarget(null) } })
  const toggleM = useMutation({ mutationFn: ({ id, a }) => a ? deactivateBankAccount(id) : activateBankAccount(id), onSuccess: inv })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Bank Accounts</h1>
          <p className="page-subtitle">{total} account{total !== 1 ? 's' : ''}</p>
        </div>
        {canWrite && <button onClick={() => setModal({ mode: 'create' })} className="btn-primary"><Plus size={16} /> Add Bank Account</button>}
      </div>

      <div className="card py-4">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search bank accounts…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['#', 'Bank', 'Account Holder', 'Account No.', 'IFSC', 'Brand', 'Range', 'Status', ...(canWrite ? ['Actions'] : [])].map((h) => (
                <th key={h} className={`px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400">No bank accounts found</td></tr>}
            {records.map((r, i) => (
              <tr key={r.id} className="hover:bg-amber-50/40 transition-colors">
                <td className="px-4 py-4 text-gray-400 text-xs">{(page-1)*20+i+1}</td>
                <td className="px-4 py-4 font-semibold text-gray-800 whitespace-nowrap">{r.bank_name}</td>
                <td className="px-4 py-4 text-gray-600">{r.account_holder_name}</td>
                <td className="px-4 py-4 font-mono text-gray-700 text-xs">{r.account_number}</td>
                <td className="px-4 py-4 font-mono text-xs text-gray-600">{r.ifsc_code}</td>
                <td className="px-4 py-4">
                  <span className="bg-accent/10 text-accent-dark text-xs font-bold px-2 py-0.5 rounded-md">{r.brand_name}</span>
                </td>
                <td className="px-4 py-4 text-gray-500 text-xs whitespace-nowrap">₹{r.range_from} – ₹{r.range_to}</td>
                <td className="px-4 py-4"><Badge variant={r.is_active ? 'active' : 'inactive'} /></td>
                {canWrite && (
                  <td className="px-4 py-4">
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
        <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Bank Account' : 'Add Bank Account'} size="lg">
          <BankForm initial={modal?.data} brands={brands} loading={createM.isPending || updateM.isPending}
            onSubmit={(vals) => modal?.mode === 'edit' ? updateM.mutate({ id: modal.data.id, d: vals }) : createM.mutate(vals)} />
          {(createM.isError || updateM.isError) && (
            <p className="text-red-500 text-sm mt-3">{createM.error?.response?.data?.message || updateM.error?.response?.data?.message || 'Error'}</p>
          )}
        </Modal>
      )}

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending} title="Delete Bank Account" message={`Delete "${delTarget?.bank_name} — ${delTarget?.account_number}"?`} />
    </div>
  )
}
