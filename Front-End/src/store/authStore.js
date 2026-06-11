import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      profileDrawerOpen:  false,
      profileForceChange: false,

      setAuth: ({ user, access, refresh }) =>
        set({ user, accessToken: access, refreshToken: refresh }),

      setAccessToken: (token) => set({ accessToken: token }),

      setTokens: ({ access, refresh }) =>
        set((s) => ({
          accessToken: access ?? s.accessToken,
          refreshToken: refresh ?? s.refreshToken,
        })),

      clearMustChangePassword: () =>
        set((s) => ({
          user: s.user ? { ...s.user, must_change_password: false } : s.user,
          profileForceChange: false,
        })),

      openProfile:  (opts = {}) => set({ profileDrawerOpen: true, profileForceChange: !!opts.force }),
      closeProfile: () => {
        const { profileForceChange } = get()
        if (profileForceChange) return   // cannot close while forced
        set({ profileDrawerOpen: false })
      },

      logout: () => set({ user: null, accessToken: null, refreshToken: null, profileDrawerOpen: false, profileForceChange: false }),

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
    {
      name: 'dwms-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
    }
  )
)
