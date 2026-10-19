import { create } from 'zustand'
import { authApi } from '@/services/api'
import { ApiError } from '@/services/http'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  status: 'idle' | 'loading' | 'ready'
  bootstrap: () => Promise<void>
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  async bootstrap() {
    if (get().status !== 'idle') return
    set({ status: 'loading' })
    try {
      const { user } = await authApi.session()
      set({ user, status: 'ready' })
    } catch (e) {
      console.warn(e instanceof ApiError ? e.message : e)
      set({ user: null, status: 'ready' })
    }
  },
  setUser: (user) => set({ user, status: 'ready' }),
  async logout() {
    try {
      await authApi.logout()
    } finally {
      set({ user: null })
    }
  },
}))
