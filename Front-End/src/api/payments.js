import api from './axios'

// QR Codes
export const getQRCodes    = (params) => api.get('/payments/qr/', { params })
export const getQRCode     = (id) => api.get(`/payments/qr/${id}/`)
export const createQRCode  = (data) => {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (k === 'brands' && Array.isArray(v)) {
      v.forEach(id => form.append('brands', id))
    } else {
      form.append(k, v)
    }
  })
  return api.post('/payments/qr/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const updateQRCode  = (id, data) => {
  const form = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (k === 'brands' && Array.isArray(v)) {
      v.forEach(bid => form.append('brands', bid))
    } else {
      form.append(k, v)
    }
  })
  return api.patch(`/payments/qr/${id}/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const deleteQRCode     = (id) => api.delete(`/payments/qr/${id}/`)
export const activateQRCode   = (id) => api.post(`/payments/qr/${id}/activate/`)
export const deactivateQRCode = (id) => api.post(`/payments/qr/${id}/deactivate/`)

// UPI Sources
export const getUPISources    = (params) => api.get('/payments/upi/', { params })
export const getUPISource     = (id) => api.get(`/payments/upi/${id}/`)
export const createUPISource  = (data) => api.post('/payments/upi/', data)
export const updateUPISource  = (id, data) => api.patch(`/payments/upi/${id}/`, data)
export const deleteUPISource     = (id) => api.delete(`/payments/upi/${id}/`)
export const activateUPISource   = (id) => api.post(`/payments/upi/${id}/activate/`)
export const deactivateUPISource = (id) => api.post(`/payments/upi/${id}/deactivate/`)

// Bank Accounts
export const getBankAccounts    = (params) => api.get('/payments/bank/', { params })
export const getBankAccount     = (id) => api.get(`/payments/bank/${id}/`)
export const createBankAccount  = (data) => api.post('/payments/bank/', data)
export const updateBankAccount  = (id, data) => api.patch(`/payments/bank/${id}/`, data)
export const deleteBankAccount     = (id) => api.delete(`/payments/bank/${id}/`)
export const activateBankAccount   = (id) => api.post(`/payments/bank/${id}/activate/`)
export const deactivateBankAccount = (id) => api.post(`/payments/bank/${id}/deactivate/`)
