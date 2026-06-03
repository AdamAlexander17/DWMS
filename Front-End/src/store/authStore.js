import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,

      setAuth: ({ user, access, refresh }) =>
        set({ user, accessToken: access, refreshToken: refresh }),

      setAccessToken: (token) => set({ accessToken: token }),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),

      /**
       * Check if the current user's role has the given permission.
       * @param {string} module  - e.g. 'brands', 'qr_codes'
       * @param {string} action  - 'view' | 'create' | 'edit' | 'delete' | 'activate'
       */
      hasPermission: (module, action = 'view') => {
        const { user } = get()
        if (!user) return false
        if (user.role === 'admin') return true   // admin always has full access
        const perms = user.permissions ?? {}
        return !!perms[module]?.[action]
      },
    }),
    { name: 'dwms-auth' }
  )
)
