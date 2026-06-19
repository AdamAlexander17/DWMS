import { useEffect, useState, useCallback, useMemo } from 'react';
import { Shield, Plus, SquarePen, Trash2, CheckCircle, XCircle, Lock, Search, X, Power, PowerOff } from 'lucide-react';
import {
  getRoles, getRole, createRole, updateRole, deleteRole,
  activateRole, deactivateRole, getModules,
} from '../api/roles';
import { useAuthStore } from '../store/authStore';
import SortableTh    from '../components/ui/SortableTh';
import { useSortable } from '../hooks/useSortable';
import Pagination from '../components/ui/Pagination';
import ConfirmDialog from '../components/ui/ConfirmDialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACTIONS = ['view', 'create', 'edit', 'delete', 'activate', 'review', 'complete'];

// Extra actions only shown for Withdrawals module
const EXTRA_ACTIONS = ['upload_slip', 'confirm_received', 'not_received', 'email_bank', 'close_ticket', 'chat'];
const EXTRA_ACTION_MODULES = ['withdrawals'];

// Modules that should NOT show the "Activate / Deactivate" permission
const NO_ACTIVATE_MODULES = ['payment_methods', 'master', 'audit_logs', 'deposit_history', 'withdrawal_history'];

// Modules that should NOT show the "Create" permission
const NO_CREATE_MODULES = ['deposit_history', 'withdrawal_history'];

// Modules that show the "Review" permission (only deposits)
const REVIEW_MODULES = ['deposits'];

// Modules that show the "Completed Status" permission (only deposits)
const COMPLETE_MODULES = ['deposits'];

// Modules that show the "Chat / Message" permission (deposits get it standalone;
// withdrawals already get it via EXTRA_ACTIONS)
const CHAT_MODULES = ['deposits', 'deposit_history', 'withdrawal_history'];

const EMPTY_PERMISSION = (module) => ({
  module,
  can_view:             false,
  can_create:           false,
  can_edit:             false,
  can_delete:           false,
  can_activate:         false,
  can_review:           false,
  can_complete:         false,
  can_upload_slip:      false,
  can_confirm_received: false,
  can_not_received:     false,
  can_email_bank:       false,
  can_close_ticket:     false,
  can_chat:             false,
});

// Human-readable label for each action within a module
function actionLabel(action, moduleLabel) {
  const m = moduleLabel || '';
  switch (action) {
    case 'view':             return `View ${m}`;
    case 'create':           return `Create ${m}`;
    case 'edit':             return `Edit ${m}`;
    case 'delete':           return `Delete ${m}`;
    case 'activate':         return `Activate / Deactivate ${m}`;
    case 'review':           return `Review ${m}`;
    case 'complete':         return `Completed Status`;
    case 'upload_slip':      return `Upload Slip`;
    case 'confirm_received': return `Confirm Received`;
    case 'not_received':     return `Not Received`;
    case 'email_bank':       return `Email to Bank`;
    case 'close_ticket':     return `Close Ticket`;
    case 'chat':             return `Chat / Message`;
    default:                 return action;
  }
}

// ---------------------------------------------------------------------------
// Grouped Permission Selector Component
// ---------------------------------------------------------------------------
function PermissionSelector({ modules, permissions, onChange }) {
  const permMap = {};
  permissions.forEach((p) => { permMap[p.module] = p; });

  const toggleAction = (modValue, action) => {
    const existing = permMap[modValue] || EMPTY_PERMISSION(modValue);
    const key = `can_${action}`;
    const updated = { ...existing, [key]: !existing[key] };
    if (action === 'view' && !updated.can_view) {
      // Turn off all when view is unchecked
      ACTIONS.concat(EXTRA_ACTIONS).forEach((a) => { updated[`can_${a}`] = false; });
    }
    if (action !== 'view' && updated[key]) updated.can_view = true;
    onChange(permissions.filter((p) => p.module !== modValue).concat(updated));
  };

  const getModuleActions = (modValue) => {
    const base = ACTIONS.filter((a) => {
      if (a === 'activate' && NO_ACTIVATE_MODULES.includes(modValue)) return false;
      if (a === 'create' && NO_CREATE_MODULES.includes(modValue)) return false;
      if (a === 'review' && !REVIEW_MODULES.includes(modValue)) return false;
      if (a === 'complete' && !COMPLETE_MODULES.includes(modValue)) return false;
      return true;
    });
    if (EXTRA_ACTION_MODULES.includes(modValue)) return [...base, ...EXTRA_ACTIONS];
    if (CHAT_MODULES.includes(modValue)) return [...base, 'chat'];
    return base;
  };

  const toggleModule = (modValue) => {
    const existing = permMap[modValue] || EMPTY_PERMISSION(modValue);
    const modActions = getModuleActions(modValue);
    const allOn = modActions.every((a) => existing[`can_${a}`]);
    const updated = { ...EMPTY_PERMISSION(modValue) };
    if (!allOn) modActions.forEach((a) => { updated[`can_${a}`] = true; });
    onChange(permissions.filter((p) => p.module !== modValue).concat(updated));
  };

  const totalActions    = modules.reduce((sum, mod) => sum + getModuleActions(mod.value).length, 0);
  const selectedActions = permissions.reduce((sum, p) => {
    const modActions = getModuleActions(p.module);
    return sum + modActions.filter((a) => p[`can_${a}`]).length;
  }, 0);

  const toggleAll = () => {
    if (selectedActions === totalActions) {
      onChange([]);
    } else {
      onChange(modules.map((mod) => {
        const p = { ...EMPTY_PERMISSION(mod.value) };
        getModuleActions(mod.value).forEach((a) => { p[`can_${a}`] = true; });
        return p;
      }));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-800">Permissions</p>
          <p className="text-xs text-gray-400">Select the permissions for this role</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-600 font-medium">
          <input
            type="checkbox"
            checked={totalActions > 0 && selectedActions === totalActions}
            onChange={toggleAll}
            className="w-4 h-4 rounded cursor-pointer accent-blue-500"
          />
          Select All
        </label>
      </div>

      <div className="space-y-2">
        {modules.map((mod) => {
          const moduleActions = [
            ...ACTIONS.filter((a) => {
              if (a === 'activate' && NO_ACTIVATE_MODULES.includes(mod.value)) return false;
              if (a === 'create' && NO_CREATE_MODULES.includes(mod.value)) return false;
              if (a === 'review' && !REVIEW_MODULES.includes(mod.value)) return false;
              if (a === 'complete' && !COMPLETE_MODULES.includes(mod.value)) return false;
              return true;
            }),
            ...(EXTRA_ACTION_MODULES.includes(mod.value) ? EXTRA_ACTIONS
                : CHAT_MODULES.includes(mod.value) ? ['chat'] : []),
          ];
          const perm         = permMap[mod.value] || EMPTY_PERMISSION(mod.value);
          const selectedCount = moduleActions.filter((a) => perm[`can_${a}`]).length;
          const allModOn     = selectedCount === moduleActions.length;

          return (
            <div key={mod.value} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                <span className="text-xs font-bold tracking-widest text-gray-700 uppercase">
                  {mod.label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{selectedCount}/{moduleActions.length}</span>
                  <input
                    type="checkbox"
                    checked={allModOn}
                    onChange={() => toggleModule(mod.value)}
                    className="w-4 h-4 rounded cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
              <div className="px-4 py-3 space-y-2.5 bg-white">
                {moduleActions.map((action) => {
                  const key     = `can_${action}`;
                  const checked = !!perm[key];
                  return (
                    <label key={action} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAction(mod.value, action)}
                        className="w-4 h-4 rounded cursor-pointer accent-blue-500"
                      />
                      <span className={`text-sm ${checked ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                        {actionLabel(action, mod.label)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role Form Modal
// ---------------------------------------------------------------------------
function RoleModal({ role, modules: propModules, onSave, onClose }) {
  const isEdit = !!role?.id;

  const [form, setForm] = useState({
    name:        role?.name        ?? '',
    description: role?.description ?? '',
    is_active:   role?.is_active   ?? true,
  });
  const [permissions,   setPermissions]   = useState([]);
  const [localModules,  setLocalModules]  = useState(propModules ?? []);
  const [errors,        setErrors]        = useState({});
  const [saving,        setSaving]        = useState(false);
  const [loadingPerms,  setLoadingPerms]  = useState(false);

  // Always fetch modules fresh on mount so checkboxes always appear
  useEffect(() => {
    if (propModules?.length) {
      setLocalModules(propModules);
    }
    getModules()
      .then((res) => {
        const mods = res.data?.data ?? [];
        if (mods.length) setLocalModules(mods);
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEdit && role?.id) {
      setLoadingPerms(true);
      getRole(role.id)
        .then((res) => {
          const data = res.data?.data ?? res.data;
          setPermissions(data.permissions || []);
        })
        .finally(() => setLoadingPerms(false));
    }
  }, [isEdit, role?.id]);

  const handleField = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    setErrors((e) => ({ ...e, [name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Role name is required';
    else if (!/^[A-Za-z][A-Za-z0-9 _-]{1,49}$/.test(form.name.trim())) {
      errs.name = 'Role name must be 2–50 chars, start with a letter, and contain only letters, digits, space, underscore or hyphen.';
    }
    if (form.description && form.description.length > 500) {
      errs.description = 'Description must be at most 500 characters.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), permissions };
      if (isEdit) {
        await updateRole(role.id, payload);
      } else {
        await createRole(payload);
      }
      onSave();
    } catch (err) {
      const data = err.response?.data;
      const apiErrs = data?.errors;
      if (apiErrs && typeof apiErrs === 'object') {
        const mapped = {};
        for (const [k, v] of Object.entries(apiErrs)) {
          mapped[k] = Array.isArray(v) ? v[0] : String(v);
        }
        setErrors(mapped);
      } else {
        setErrors({ name: data?.message || 'Something went wrong' });
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = permissions.reduce((sum, p) =>
    sum + ACTIONS.filter((a) => p[`can_${a}`]).length, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/30 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl bg-accent">
          <div>
            <h2 className="text-base font-bold text-white">
              {isEdit ? 'Edit Role' : 'Create New Role'}
            </h2>
            <p className="text-xs text-white/70 mt-0.5">Define role permissions and access levels</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

            {/* Basic Information */}
            <div>
          <p className="text-xs font-bold tracking-widest uppercase text-accent mb-3">Basic Information</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleField}
                    placeholder="e.g. Marketing Manager"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40
                      ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="is_active"
                    value={form.is_active ? 'true' : 'false'}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  name="description"
                  value={form.description}
                  onChange={handleField}
                  placeholder="Brief description of the role"
                  maxLength={500}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 ${errors.description ? 'border-red-400' : 'border-gray-300'}`}
                />
                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
              </div>
            </div>

            {/* Permissions */}
            {loadingPerms ? (
              <p className="text-sm text-gray-400">Loading permissions…</p>
            ) : (
              <PermissionSelector
                modules={localModules}
                permissions={permissions}
                onChange={setPermissions}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-2xl">
            <span className="text-sm font-semibold text-accent">
              {selectedCount} permission{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-dark text-white text-sm font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permission preview badges
// ---------------------------------------------------------------------------
function PermissionBadges({ role }) {
  const count = role.permissions_count ?? role.permissions?.reduce((sum, p) =>
    sum + ['can_view','can_create','can_edit','can_delete','can_activate','can_review','can_complete'].filter(k => p[k]).length, 0) ?? 0;
  if (count === 0) return <span className="text-xs text-gray-400">No permissions</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/20 rounded-full px-2.5 py-0.5 font-medium">
      <Lock size={10} />
      {count} permission{count !== 1 ? 's' : ''}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function Roles() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate   = hasPermission('roles', 'create');
  const canEdit     = hasPermission('roles', 'edit');
  const canDelete   = hasPermission('roles', 'delete');
  const canActivate = hasPermission('roles', 'activate');

  const [roles,   setRoles]   = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [search,  setSearch]  = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal,   setModal]   = useState(null); // null | { mode: 'create'|'edit', role? }
  const [delConfirm, setDelConfirm] = useState(null);

  const fetchRoles = useCallback(async (searchTerm = '') => {
    setLoading(true);
    try {
      const res = await getRoles(searchTerm ? { search: searchTerm } : undefined);
      setRoles(res.data?.data?.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchRoles(debouncedSearch);
  }, [fetchRoles, debouncedSearch]);

  useEffect(() => {
    getModules().then((res) => setModules(res.data?.data ?? []));
  }, []);

  const handleSaved = () => {
    setModal(null);
    fetchRoles();
  };

  const handleToggleActive = async (role) => {
    try {
      if (role.is_active) {
        await deactivateRole(role.id);
      } else {
        await activateRole(role.id);
      }
      fetchRoles();
    } catch (err) {
      alert(err.response?.data?.message ?? 'Action failed');
    }
  };

  const handleDelete = async (role) => {
    try {
      await deleteRole(role.id);
      setDelConfirm(null);
      fetchRoles();
    } catch (err) {
      alert(err.response?.data?.message ?? 'Cannot delete this role');
      setDelConfirm(null);
    }
  };

  const filteredRoles = roles;

  const getRoleVal = (r, key) => {
    if (key === 'name')        return (r.name ?? '').toLowerCase()
    if (key === 'description') return (r.description ?? '').toLowerCase()
    if (key === 'permissions') return (r.permissions?.length ?? r.permission_count ?? 0)
    if (key === 'status')      return r.is_active ? 1 : 0
    if (key === 'system')      return r.is_system ? 1 : 0
    return ''
  }
  const { sorted: sortedRoles, toggle: toggleSort, icon: sortIcon } =
    useSortable(filteredRoles, getRoleVal, 'name', 'asc');

  const totalPages = Math.max(1, Math.ceil(sortedRoles.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRoles = sortedRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Roles</h1>
          <p className="page-subtitle">{roles.length} role{roles.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && (
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary">
            <Plus size={16} /> Add Role
          </button>
        )}
      </div>

      {/* Filter + Pagination bar */}
      <div className="card py-4 flex items-center justify-between gap-3">
        <div className="relative w-[320px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search role or username…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="shrink-0">
          <Pagination
            current={currentPage}
            total={totalPages}
            onPage={setPage}
            pageSize={pageSize}
            onPageSizeChange={(v) => { setPageSize(v); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-center">
                <SortableTh label="Role"        sortKey="name"        toggle={toggleSort} icon={sortIcon} left />
                <SortableTh label="Description" sortKey="description" toggle={toggleSort} icon={sortIcon} />
                <SortableTh label="Permissions" sortKey="permissions" toggle={toggleSort} icon={sortIcon} />
                <SortableTh label="Status"      sortKey="status"      toggle={toggleSort} icon={sortIcon} />
                <SortableTh label="System"      sortKey="system"      toggle={toggleSort} icon={sortIcon} />
                {(canEdit || canDelete || canActivate) && (
                  <th className="px-4 py-2.5 font-semibold text-gray-700 text-[11px] uppercase tracking-wider text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
            {filteredRoles.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">No roles found</td></tr>
            )}
            {pagedRoles.map((role, i) => (
                <tr key={role.id} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-gray-800 capitalize">{role.name.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate text-center">{role.description || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <PermissionBadges role={role} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {role.is_active ? (
                      <span className="inline-flex items-center justify-center gap-1 min-w-[96px] bg-green-50 text-green-700 border border-green-200 rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                        <CheckCircle size={10} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1 min-w-[96px] bg-red-50 text-red-600 border border-red-200 rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                        <XCircle size={10} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {role.is_system ? (
                      <span className="text-xs text-accent font-medium flex items-center justify-center gap-1">
                        <Lock size={12} /> System
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Custom</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {canActivate && (
                        <button onClick={() => handleToggleActive(role)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors"
                          title={role.is_active ? 'Deactivate' : 'Activate'}>
                          {role.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => setModal({ mode: 'edit', role })}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Edit role">
                          <SquarePen size={12} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDelConfirm(role)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                          title="Delete role">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      {modal && (
        <RoleModal
          role={modal.role ?? null}
          modules={modules}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!delConfirm}
        onClose={() => setDelConfirm(null)}
        onConfirm={() => handleDelete(delConfirm)}
        title="Delete Role"
        message={`Delete "${delConfirm?.name?.replace(/_/g, ' ')}"? This cannot be undone.`}
      />
    </div>
  );
}

