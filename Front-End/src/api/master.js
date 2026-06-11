import api from './axios'

// Master – Gateways
export const getGateways    = (params)   => api.get('/master/gateways', { params })
export const createGateway  = (data)     => api.post('/master/gateways', data)
export const updateGateway  = (id, data) => api.patch(`/master/gateways/${id}`, data)
export const deleteGateway  = (id)       => api.delete(`/master/gateways/${id}`)
export const activateGateway   = (id) => api.post(`/master/gateways/${id}/activate`)
export const deactivateGateway = (id) => api.post(`/master/gateways/${id}/deactivate`)
