import { useEffect, useState, useCallback } from 'react';
import { Shield, Plus, Edit2, Trash2, CheckCircle, XCircle, Lock } from 'lucide-react';
import {
  getRoles, getRole, createRole, updateRole, deleteRole,
  activateRole, deactivateRole, getModules,
} from '../api/roles';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ACTIONS = ['view', 'create', 'edit', 'delete', 'activate'];

const EMPTY_PERMISSION = (module) => ({
  module,
  can_view:     false,
  can_create:   false,
  can_edit:     false,
  can_delete:   false,
  can_activate: false,
});

// Human-readable label for each action within a module
function actionLabel(action, moduleLabel) {
  const m = moduleLabel || '';
  switch (action) {
    case 'view':     return `View ${m}`;
    case 'create':   return `Create ${m}`;
    case 'edit':     return `Edit ${m}`;
    case 'delete':   return `Delete ${m}`;
    case 'activate': return `Activate / Deactivate ${m}`;
    default:         return action;
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
      updated.can_create = updated.can_edit = updated.can_delete = updated.can_activate = false;
    }
    if (action !== 'view' && updated[key]) updated.can_view = true;
    onChange(permissions.filter((p) => p.module !== modValue).concat(updated));
  };

  const toggleModule = (modValue) => {
    const existing = permMap[modValue] || EMPTY_PERMISSION(modValue);
    const allOn = ACTIONS.every((a) => existing[`can_${a}`]);
    const updated = { ...EMPTY_PERMISSION(modValue) };
    if (!allOn) ACTIONS.forEach((a) => { updated[`can_${a}`] = true; });
    onChange(permissions.filter((p) => p.module !== modValue).concat(updated));
  };

  const totalActions    = modules.length * ACTIONS.length;
  const selectedActions = permissions.reduce((sum, p) =>
    sum + ACTIONS.filter((a) => p[`can_${a}`]).length, 0);

  const toggleAll = () => {
    if (selectedActions === totalActions) {
      onChange([]);
    } else {
      onChange(modules.map((mod) => {
        const p = { ...EMPTY_PERMISSION(mod.value) };
        ACTIONS.forEach((a) => { p[`can_${a}`] = true; });
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
            className="w-4 h-4 rounded cursor-pointer accent-amber-500"
          />
          Select All
        </label>
      </div>

      <div className="space-y-2">
        {modules.map((mod) => {
          const perm         = permMap[mod.value] || EMPTY_PERMISSION(mod.value);
          const selectedCount = ACTIONS.filter((a) => perm[`can_${a}`]).length;
          const allModOn     = selectedCount === ACTIONS.length;

          return (
            <div key={mod.value} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                <span className="text-xs font-bold tracking-widest text-gray-700 uppercase">
                  {mod.label.replace(/ /g, ' ')}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{selectedCount}/{ACTIONS.length}</span>
                  <input
                    type="checkbox"
                    checked={allModOn}
                    onChange={() => toggleModule(mod.value)}
                    className="w-4 h-4 rounded cursor-pointer accent-amber-500"
                  />
                </div>
              </div>
              <div className="px-4 py-3 space-y-2.5 bg-white">
                {ACTIONS.map((action) => {
                  const key     = `can_${action}`;
                  const checked = !!perm[key];
                  return (
                    <label key={action} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAction(mod.value, action)}
                        className="w-4 h-4 rounded cursor-pointer accent-amber-500"
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

  // Always fetch fresh modules inside the modal so checkboxes always appear
  useEffect(() => {
    if (!propModules?.length) {
      getModules().then((res) => setLocalModules(res.data?.data ?? []));
    } else {
      setLocalModules(propModules);
    }
  }, [propModules]);

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
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, permissions };
      if (isEdit) {
        await updateRole(role.id, payload);
      } else {
        await createRole(payload);
      }
      onSave();
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) setErrors(data.errors);
      else setErrors({ name: data?.message || 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = permissions.reduce((sum, p) =>
    sum + ACTIONS.filter((a) => p[`can_${a}`]).length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

        {/* Header — app dark theme */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-2xl bg-sidebar-bg">
          <div>
            <h2 className="text-base font-bold text-white">
              {isEdit ? 'Edit Role' : 'Create New Role'}
            </h2>
            <p className="text-xs text-white/50 mt-0.5">Define role permissions and access levels</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl font-bold leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">

            {/* Basic Information */}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-amber-600 mb-3">Basic Information</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleField}
                    disabled={isEdit && role?.is_system}
                    placeholder="e.g. Marketing Manager"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400
                      ${errors.name ? 'border-red-400' : 'border-gray-300'}
                      ${isEdit && role?.is_system ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                  />
                  {isEdit && role?.is_system && (
                    <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                      <Lock size={11} /> System role — name locked
                    </p>
                  )}
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="is_active"
                    value={form.is_active ? 'true' : 'false'}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
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
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 rounded-b-2xl">
            <span className="text-sm font-semibold text-amber-600">
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
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-60"
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
    sum + ['can_view','can_create','can_edit','can_delete','can_activate'].filter(k => p[k]).length, 0) ?? 0;
  if (count === 0) return <span className="text-xs text-gray-400">No permissions</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 font-medium">
      <Lock size={10} />
      {count} permission{count !== 1 ? 's' : ''}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function Roles() {
  const [roles,   setRoles]   = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | { mode: 'create'|'edit', role? }
  const [delConfirm, setDelConfirm] = useState(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRoles();
      setRoles(res.data?.data?.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    getModules().then((res) => setModules(res.data?.data ?? []));
  }, [fetchRoles]);

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

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Roles</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage roles and their module permissions dynamically
          </p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow"
        >
          <Plus size={16} /> Add Role
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : roles.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p>No roles found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Role</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Permissions</th>
                <th className="text-center px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-center px-5 py-3 font-semibold text-gray-600">System</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-semibold text-gray-800 capitalize">{role.name.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{role.description || '—'}</td>
                  <td className="px-5 py-3">
                    <PermissionBadges role={role} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    {role.is_active ? (
                      <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 text-xs font-medium">
                        <CheckCircle size={10} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5 text-xs font-medium">
                        <XCircle size={10} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {role.is_system ? (
                      <span className="text-xs text-amber-600 font-medium flex items-center justify-center gap-1">
                        <Lock size={12} /> System
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Custom</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {/* Edit */}
                      <button
                        onClick={() => setModal({ mode: 'edit', role })}
                        className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 hover:text-amber-700"
                        title="Edit role"
                      >
                        <Edit2 size={15} />
                      </button>

                      {/* Activate / Deactivate */}
                      <button
                        onClick={() => handleToggleActive(role)}
                        className={`p-1.5 rounded-lg text-sm ${
                          role.is_active
                            ? 'hover:bg-red-50 text-red-400 hover:text-red-600'
                            : 'hover:bg-green-50 text-green-500 hover:text-green-700'
                        }`}
                        title={role.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {role.is_active ? <XCircle size={15} /> : <CheckCircle size={15} />}
                      </button>

                      {/* Delete — disabled for system roles */}
                      {!role.is_system && (
                        <button
                          onClick={() => setDelConfirm(role)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"
                          title="Delete role"
                        >
                          <Trash2 size={15} />
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
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Delete Role</h3>
            <p className="text-sm text-gray-600 mb-5">
              Are you sure you want to delete{' '}
              <strong className="capitalize">{delConfirm.name.replace(/_/g, ' ')}</strong>?
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDelConfirm(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(delConfirm)}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
