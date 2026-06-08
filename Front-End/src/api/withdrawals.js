import api from './axios'

export const getWithdrawals      = (params) => api.get('/withdrawals/', { params })
export const getWithdrawal       = (id) => api.get(`/withdrawals/${id}/`)
export const getWithdrawalStats  = () => api.get('/withdrawals/stats/')
export const createWithdrawal    = (data) => api.post('/withdrawals/', data)
export const updateWithdrawal    = (id, data) => api.patch(`/withdrawals/${id}/`, data)
export const deleteWithdrawal    = (id) => api.delete(`/withdrawals/${id}/`)
export const reviewWithdrawal    = (id, data) => api.post(`/withdrawals/${id}/review/`, data)

// Ticket workflow
export const uploadSlip          = (id, formData) =>
  api.post(`/withdrawals/${id}/upload-slip/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const confirmReceived     = (id) => api.post(`/withdrawals/${id}/confirm-received/`)
export const notReceived         = (id, data) => api.post(`/withdrawals/${id}/not-received/`, data)
export const markEmailSent       = (id, data) => api.post(`/withdrawals/${id}/email-sent/`, data)

// Notifications
export const getWdNotifications  = () => api.get('/withdrawals/notifications/')
export const getWdUnreadCount    = () => api.get('/withdrawals/notifications-count/')
export const markWdAllRead       = () => api.post('/withdrawals/notifications-read-all/')
export const markWdNotifRead     = (id) => api.post(`/withdrawals/${id}/notifications-read/`)
export const deleteWdNotif       = (id) => api.delete(`/withdrawals/${id}/notifications-delete/`)
export const clearAllWdNotifs    = () => api.post('/withdrawals/notifications-clear-all/')

// Conversation / messages
export const getMessages         = (id) => api.get(`/withdrawals/${id}/messages/`)
export const postMessage         = (id, formData) =>
  api.post(`/withdrawals/${id}/messages/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const manualClose         = (id, data) => api.post(`/withdrawals/${id}/manual-close/`, data)
