import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
  headers: { 'Content-Type': 'application/json' },
})

let refreshPromise = null

const shouldSkipRefresh = (url = '') => (
  url.includes('/auth/login/')
  || url.includes('/auth/token/refresh/')
  || url.includes('/auth/logout/')
)

async function refreshAccessToken() {
  const { refreshToken, setAccessToken, logout } = useAuthStore.getState()
  if (!refreshToken) {
    logout()
    return null
  }

  if (!refreshPromise) {
    refreshPromise = axios.post(
      `${api.defaults.baseURL}/auth/token/refresh/`,
      { refresh: refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    )
      .then((res) => {
        const newAccess = res?.data?.data?.access || res?.data?.access
        if (!newAccess) throw new Error('No access token in refresh response')
        setAccessToken(newAccess)
        return newAccess
      })
      .catch(() => {
        logout()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

// Attach access token to every request; auto-handle FormData Content-Type
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  // When sending FormData, delete Content-Type so the browser sets it
  // automatically with the correct multipart boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// On 401 → log out
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status
    const original = error.config || {}

    if (status === 401 && !original._retry && !shouldSkipRefresh(original.url || '')) {
      original._retry = true
      const newAccess = await refreshAccessToken()
      if (newAccess) {
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      }
    }

    if (status === 401) {
      useAuthStore.getState().logout()
    }

    return Promise.reject(error)
  }
)

export default api
