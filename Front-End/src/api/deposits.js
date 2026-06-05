import api from './axios'

// Deposit Logs
export const getDeposits    = (params) => api.get('/deposits/', { params })
export const getDeposit     = (id) => api.get(`/deposits/${id}/`)
export const createDeposit  = (data) => api.post('/deposits/', data)
export const updateDeposit  = (id, data) => api.patch(`/deposits/${id}/`, data)
export const deleteDeposit  = (id) => api.delete(`/deposits/${id}/`)
export const reviewDeposit  = (id, data) => api.post(`/deposits/${id}/review/`, data)

// Notifications
export const getNotifications     = (params) => api.get('/deposits/notifications/', { params })
export const getUnreadCount       = ()  => api.get('/deposits/notifications/unread_count/')
export const markNotificationRead = (id) => api.post(`/deposits/notifications/${id}/mark_read/`)
export const markAllRead          = ()  => api.post('/deposits/notifications/mark_all_read/')
