import api from './axios'

export const getWithdrawals    = (params) => api.get('/withdrawals/', { params })
export const getWithdrawal     = (id) => api.get(`/withdrawals/${id}/`)
export const createWithdrawal  = (data) => {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') fd.append(k, v) })
  return api.post('/withdrawals/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const updateWithdrawal  = (id, data) => {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') fd.append(k, v) })
  return api.patch(`/withdrawals/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const deleteWithdrawal  = (id) => api.delete(`/withdrawals/${id}/`)
export const reviewWithdrawal  = (id, data) => api.post(`/withdrawals/${id}/review/`, data)
