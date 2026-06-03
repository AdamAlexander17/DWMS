import api from './axios'

export const getBrands  = (params) => api.get('/brands/', { params })
export const getBrand   = (id) => api.get(`/brands/${id}/`)
export const createBrand = (data) => api.post('/brands/', data)
export const updateBrand = (id, data) => api.patch(`/brands/${id}/`, data)
export const deleteBrand = (id) => api.delete(`/brands/${id}/`)
export const activateBrand   = (id) => api.post(`/brands/${id}/activate/`)
export const deactivateBrand = (id) => api.post(`/brands/${id}/deactivate/`)
