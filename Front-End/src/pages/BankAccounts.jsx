import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, SquarePen, Trash2, Power, PowerOff, Search } from 'lucide-react'
import { getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount, activateBankAccount, deactivateBankAccount } from '../api/payments'
import { getBrands } from '../api/brands'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import { PageSpinner } from '../components/ui/Spinner'
import CapacityBar from '../components/ui/CapacityBar'
import { useAuthStore } from '../store/authStore'
import {
  ifsc as vIfsc,
  accountNumber as vAcct,
  safeName as vSafe,
  positiveAmount as vAmt,
  rangeOrder,
  extractApiErrors,
} from '../utils/validators'

function BankForm({ initial, brands, onSubmit, loading, apiErrors = {} }) {
  const [form, setForm] = useState({
    bank_name:            initial?.bank_name            ?? '',
    account_holder_name:  initial?.account_holder_name  ?? '',
    account_number:       initial?.account_number       ?? '',
    ifsc_code:            initial?.ifsc_code            ?? '',
    branch_name:          initial?.branch_name          ?? '',
    brand:                initial?.brand                ?? '',
    range_from:           initial?.range_from           ?? '',
    range_to:             initial?.range_to             ?? '',
    daily_limit:          initial?.daily_limit          ?? '',
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); if (local[k]) setLocal(p => ({ ...p, [k]: undefined })) }
  const E = (k) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>
  const cls = (k) => `input ${errors[k] ? 'border-red-300' : ''}`

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    const bn  = vSafe(form.bank_name, 'Bank name', 100);            if (bn)  errs.bank_name = bn
    const ah  = vSafe(form.account_holder_name, 'Account holder', 150); if (ah) errs.account_holder_name = ah
    const an  = vAcct(form.account_number);                         if (an)  errs.account_number = an
    const ic  = vIfsc(form.ifsc_code);                              if (ic)  errs.ifsc_code = ic
    if (form.branch_name) {
      const br = vSafe(form.branch_name, 'Branch name', 100);        if (br)  errs.branch_name = br
    }
    if (!form.brand) errs.brand = 'Please select a brand.'
    const rf = vAmt(form.range_from, { label: 'Range From' });      if (rf)  errs.range_from = rf
    const rt = vAmt(form.range_to, { label: 'Range To' });          if (rt)  errs.range_to = rt
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
      onSubmit({
        ...form,
        bank_name:           form.bank_name.trim(),
        account_holder_name: form.account_holder_name.trim(),
        ifsc_code:           form.ifsc_code.toUpperCase().trim(),
        account_number:      String(form.account_number).replace(/\D/g, ''),
        branch_name:         form.branch_name.trim(),
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name *</label>
          <input className={cls('bank_name')} value={form.bank_name} onChange={(e) => f('bank_name')(e.target.value)} maxLength={100} />
          {E('bank_name')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Brand *</label>
          <select className={cls('brand')} value={form.brand} onChange={(e) => f('brand')(e.target.value)}>
            <option value="">Select brand</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {E('brand')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Holder *</label>
          <input className={cls('account_holder_name')} value={form.account_holder_name} onChange={(e) => f('account_holder_name')(e.target.value)} maxLength={150} />
          {E('account_holder_name')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number *</label>
          <input
            className={cls('account_number')}
            inputMode="numeric"
            value={form.account_number}
            onChange={(e) => f('account_number')(e.target.value.replace(/\D/g, ''))}
            maxLength={18}
          />
          {E('account_number')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">IFSC Code *</label>
          <input
            className={cls('ifsc_code')}
            value={form.ifsc_code}
            onChange={(e) => f('ifsc_code')(e.target.value.toUpperCase())}
            maxLength={11}
            placeholder="HDFC0001234"
          />
          {E('ifsc_code')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch Name</label>
          <input className={cls('branch_name')} value={form.branch_name} onChange={(e) => f('branch_name')(e.target.value)} maxLength={100} />
          {E('branch_name')}
        </div>
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
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Limit (₹) <span className="text-gray-400 font-normal">— optional</span></label>
          <input type="number" className={cls('daily_limit')} placeholder="e.g. 200000" value={form.daily_limit} onChange={(e) => f('daily_limit')(e.target.value)} step="0.01" min="0" />
          {E('daily_limit')}
        </div>
      </div>
      {errors.non_field && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{errors.non_field}</div>
      )}
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
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              {['Bank', 'Account Holder', 'Account No.', 'IFSC', 'Brand', 'Range', 'Daily Capacity', 'Status', ...(canWrite ? ['Actions'] : [])].map((h) => (
                <th key={h} className={`px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider whitespace-nowrap ${h === 'Actions' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {records.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">No bank accounts found</td></tr>}
            {records.map((r, i) => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-2.5 font-medium text-gray-800 text-xs whitespace-nowrap">{r.bank_name}</td>
                <td className="px-4 py-2.5 text-gray-600 text-xs">{r.account_holder_name}</td>
                <td className="px-4 py-2.5 font-mono text-gray-700 text-xs">{r.account_number}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{r.ifsc_code}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center justify-center gap-1 min-w-[64px] px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-accent/10 text-accent-dark border-accent/20 whitespace-nowrap">{r.brand_name}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">₹{r.range_from} – ₹{r.range_to}</td>
                <td className="px-4 py-2.5"><CapacityBar capacity={r.capacity} /></td>
                <td className="px-4 py-2.5"><Badge variant={r.is_active ? 'active' : 'inactive'} /></td>
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
        <div className="px-5 py-3 border-t border-gray-50"><Pagination current={page} total={totalPages} onPage={setPage} /></div>
      </div>

      {canWrite && (
        <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Edit Bank Account' : 'Add Bank Account'} size="lg">
          <BankForm
            initial={modal?.data}
            brands={brands}
            loading={createM.isPending || updateM.isPending}
            apiErrors={extractApiErrors(createM.error || updateM.error || {})}
            onSubmit={(vals) => modal?.mode === 'edit' ? updateM.mutate({ id: modal.data.id, d: vals }) : createM.mutate(vals)}
          />
        </Modal>
      )}

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => deleteM.mutate(delTarget.id)}
        loading={deleteM.isPending} title="Delete Bank Account" message={`Delete "${delTarget?.bank_name} — ${delTarget?.account_number}"?`} />
    </div>
  )
}
