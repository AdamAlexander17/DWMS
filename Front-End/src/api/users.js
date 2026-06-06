import api from './axios'

export const getUsers       = (params) => api.get('/users/', { params })
export const getUser        = (id) => api.get(`/users/${id}/`)
export const createUser     = (data) => api.post('/users/', data)
export const updateUser     = (id, data) => api.patch(`/users/${id}/`, data)
export const deleteUser     = (id) => api.delete(`/users/${id}/`)
export const activateUser   = (id) => api.post(`/users/${id}/activate/`)
export const deactivateUser = (id) => api.post(`/users/${id}/deactivate/`)
export const resetPassword  = (id, new_password) => api.post(`/users/${id}/reset-password/`, { new_password })
export const bulkImportUsers = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/users/bulk-import/', fd)
}
