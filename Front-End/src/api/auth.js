import api from './axios'

export const login = (credentials) => api.post('/auth/login/', credentials)
export const logout = (refresh) => api.post('/auth/logout/', { refresh })
export const refreshToken = (refresh) => api.post('/auth/token/refresh/', { refresh })
export const changePassword = (data) => api.post('/auth/change-password/', data)
export const getProfile = () => api.get('/auth/profile/')
export const getPermissions = () => api.get('/auth/permissions/')
