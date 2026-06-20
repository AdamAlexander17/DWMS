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

      // Update user permissions in-place (called when admin changes role permissions)
      updatePermissions: ({ permissions, role, role_id, brand_ids }) =>
        set((s) => ({
          user: s.user ? {
            ...s.user,
            permissions: permissions ?? s.user.permissions,
            role: role ?? s.user.role,
            role_id: role_id ?? s.user.role_id,
            brand_ids: brand_ids ?? s.user.brand_ids,
          } : s.user,
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

      isAdmin: () => {
        const { user } = get()
        return !!(user?.is_superuser)
      },

      hasAnyModulePermission: (modules, action = 'view') => {
        const { user } = get()
        if (!user || !Array.isArray(modules) || modules.length === 0) return false
        const perms = user.permissions ?? {}
        return modules.some((module) => !!perms[module]?.[action])
      },

      /**
       * Check if the current user's role has the given permission.
       * @param {string} module  - e.g. 'brands', 'qr_codes'
       * @param {string} action  - 'view' | 'create' | 'edit' | 'delete' | 'activate'
       */
      hasPermission: (module, action = 'view') => {
        const { user } = get()
        if (!user) return false
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
