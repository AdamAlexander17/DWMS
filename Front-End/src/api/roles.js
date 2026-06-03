import api from './axios';

export const getRoles      = (params) => api.get('/roles', { params });
export const getRole       = (id)     => api.get(`/roles/${id}`);
export const createRole    = (data)   => api.post('/roles', data);
export const updateRole    = (id, data) => api.put(`/roles/${id}`, data);
export const deleteRole    = (id)     => api.delete(`/roles/${id}`);
export const activateRole  = (id)     => api.post(`/roles/${id}/activate`);
export const deactivateRole = (id)    => api.post(`/roles/${id}/deactivate`);
export const getRoleMatrix = (id)     => api.get(`/roles/${id}/permissions/matrix`);
export const getModules    = ()       => api.get('/roles/modules');
