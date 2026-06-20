import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, SquarePen, Trash2, Power, PowerOff, Search } from 'lucide-react'
import { getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount, activateBankAccount, deactivateBankAccount } from '../api/payments'
import { getBrands } from '../api/brands'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import Badge from '../components/ui/Badge'
import Pagination from '../components/ui/Pagination'
import SortableTh    from '../components/ui/SortableTh'
import { useSortable } from '../hooks/useSortable'
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
    brands:               (initial?.brands ?? []).map(String),
    range_from:           initial?.range_from           ?? '',
    range_to:             initial?.range_to             ?? '',
    daily_limit:          initial?.daily_limit          ?? '',
  })
  const [local, setLocal] = useState({})
  const errors = { ...apiErrors, ...local }
  const f = (k) => (v) => { setForm((p) => ({ ...p, [k]: v })); if (local[k]) setLocal(p => ({ ...p, [k]: undefined })) }
  const E = (k) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>
  const cls = (k) => `input ${errors[k] ? 'border-red-300' : ''}`

  const toggleBrand = (id) => {
    const sid = String(id)
    setForm(p => ({
      ...p,
      brands: p.brands.includes(sid) ? p.brands.filter(b => b !== sid) : [...p.brands, sid],
    }))
    if (local.brands) setLocal(p => ({ ...p, brands: undefined }))
  }

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
    if (!form.brands.length) errs.brands = 'Please select at least one brand.'
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
        brands:              form.brands.map(Number),
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
        <div className="col-span-2 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch Name</label>
            <input className={cls('branch_name')} value={form.branch_name} onChange={(e) => f('branch_name')(e.target.value)} maxLength={100} />
            {E('branch_name')}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brands *</label>
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
            {E('brands')}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
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
        <input type="number" className={cls('daily_limit')} placeholder="e.g. 200000" value={form.daily_limit} onChange={(e) => f('daily_limit')(e.target.value)} step="0.01" min="0" />
        {E('daily_limit')}
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
  const { user, hasPermission } = useAuthStore()
  const canCreate   = hasPermission('bank_accounts', 'create')
  const canEdit     = hasPermission('bank_accounts', 'edit')
  const canDelete   = hasPermission('bank_accounts', 'delete')
  const canActivate = hasPermission('bank_accounts', 'activate')
  const canWrite    = canCreate || canEdit || canDelete || canActivate
  const [page, setPage]  = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const [delTarget, setDelTarget] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['bank-accounts', page, pageSize, debouncedSearch],
    queryFn:  () => getBankAccounts({ page, page_size: pageSize, search: debouncedSearch }),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
  })
  const { data: brandsData } = useQuery({ queryKey: ['brands-all'], queryFn: () => getBrands({ page_size: 100 }) })

  const records    = data?.data?.data?.results ?? []
  const total      = data?.data?.data?.count   ?? 0
  const totalPages = data?.data?.data?.total_pages ?? 1
  const allBrands  = brandsData?.data?.data?.results ?? []
  const brands     = (user?.brand_ids ?? []).length === 0
    ? allBrands
    : allBrands.filter(b => (user?.brand_ids ?? []).includes(b.id))

  const getBankVal = (r, key) => {
    if (key === 'bank')       return (r.bank_name ?? '').toLowerCase()
    if (key === 'holder')     return (r.account_holder_name ?? '').toLowerCase()
    if (key === 'acct_no')    return (r.account_number ?? '').toLowerCase()
    if (key === 'ifsc')       return (r.ifsc_code ?? '').toLowerCase()
    if (key === 'brand')      return (r.brand_name ?? '').toLowerCase()
    if (key === 'range')      return Number(r.range_from ?? 0)
    if (key === 'capacity')   return Number(r.daily_limit ?? 0)
    if (key === 'status')     return r.is_active ? 1 : 0
    return ''
  }
  const { sorted: sortedRecords, toggle: toggleSort, icon: sortIcon } =
    useSortable(records, getBankVal, 'bank', 'asc')

  const inv      = () => qc.invalidateQueries({ queryKey: ['bank-accounts'] })
  const resetView = () => { setSearch(''); setPage(1) }
  const createM = useMutation({ mutationFn: createBankAccount,                  onSuccess: () => { resetView(); inv(); setModal(null) } })
  const updateM = useMutation({ mutationFn: ({ id, d }) => updateBankAccount(id, d), onSuccess: () => { inv(); setModal(null) } })
  const deleteM = useMutation({ mutationFn: deleteBankAccount,                  onSuccess: () => { inv(); setDelTarget(null) } })
  const toggleM = useMutation({
    mutationFn: ({ id, a }) => a ? deactivateBankAccount(id) : activateBankAccount(id),
    onMutate: async ({ id, a }) => {
      await qc.cancelQueries({ queryKey: ['bank-accounts'] })
      const prev = qc.getQueryData(['bank-accounts', page, pageSize, debouncedSearch])
      qc.setQueryData(['bank-accounts', page, pageSize, debouncedSearch], (old) => {
        if (!old) return old
        const results = old?.data?.data?.results ?? []
        const updated = results.map((r) => r.id === id ? { ...r, is_active: !a } : r)
        return { ...old, data: { ...old.data, data: { ...old.data.data, results: updated } } }
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['bank-accounts', page, pageSize, debouncedSearch], ctx.prev)
    },
    onSettled: inv,
  })

  if (isLoading) return <PageSpinner />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Bank Accounts</h1>
          <p className="page-subtitle">{total} account{total !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && <button onClick={() => setModal({ mode: 'create' })} className="btn-primary"><Plus size={16} /> Add Bank Account</button>}
      </div>

      <div className="card py-4 flex items-center justify-between gap-3">
        <div className="relative w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search bank accounts…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <div className="shrink-0">
          <Pagination current={page} total={totalPages} onPage={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(1) }} />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-center">
              <SortableTh label="Bank"           sortKey="bank"     toggle={toggleSort} icon={sortIcon} left />
              <SortableTh label="Account Holder" sortKey="holder"   toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Account No."   sortKey="acct_no"  toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="IFSC"           sortKey="ifsc"     toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Brands"         sortKey="brand"    toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Range"          sortKey="range"    toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Daily Limit"    sortKey="capacity" toggle={toggleSort} icon={sortIcon} />
              <SortableTh label="Status"         sortKey="status"   toggle={toggleSort} icon={sortIcon} />
              {canWrite && <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.length === 0 && <tr><td colSpan={canWrite ? 9 : 8} className="px-4 py-10 text-center text-gray-400 text-sm">No bank accounts found</td></tr>}
            {sortedRecords.map((r, i) => (
              <tr key={r.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-4 py-2.5 font-medium text-gray-800 text-sm whitespace-nowrap">{r.bank_name}</td>
                <td className="px-4 py-2.5 text-gray-600 text-sm text-center">{r.account_holder_name}</td>
                <td className="px-4 py-2.5 font-mono text-gray-700 text-sm text-center">{r.account_number}</td>
                <td className="px-4 py-2.5 font-mono text-sm text-gray-600 text-center">{r.ifsc_code}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className="inline-flex items-center justify-center gap-1 min-w-[96px] px-2 py-0.5 rounded-md text-xs font-semibold border bg-accent/10 text-accent-dark border-accent/20 whitespace-nowrap">{r.brand_name}</span>
                </td>
                <td className="px-4 py-2.5 text-gray-600 text-sm whitespace-nowrap text-center">₹{Number(r.range_from).toLocaleString('en-IN')} – ₹{Number(r.range_to).toLocaleString('en-IN')}</td>
                <td className="px-4 py-2.5 text-center">
                  {r.daily_limit
                    ? <span className="text-sm text-gray-700 font-medium">₹{Number(r.daily_limit).toLocaleString('en-IN')}</span>
                    : <span className="text-xs text-gray-300 italic">No limit</span>
                  }
                </td>
                <td className="px-4 py-2.5 text-center"><Badge variant={r.is_active ? 'active' : 'inactive'} /></td>
                {canWrite && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      {canActivate && (
                        <button onClick={() => toggleM.mutate({ id: r.id, a: r.is_active })} title={r.is_active ? 'Deactivate' : 'Activate'} className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors">
                          {r.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => setModal({ mode: 'edit', data: r })} title="Edit" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"><SquarePen size={12} /></button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDelTarget(r)} title="Delete" className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"><Trash2 size={12} /></button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(canCreate || canEdit) && (
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
