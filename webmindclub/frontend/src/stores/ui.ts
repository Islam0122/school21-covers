import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Appearance = 'dark' | 'light' | 'system'

interface UiState {
  appearance: Appearance
  sidebarOpen: boolean
  setAppearance: (a: Appearance) => void
  setSidebarOpen: (open: boolean) => void
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      appearance: 'dark',
      sidebarOpen: false,
      setAppearance: (appearance) => {
        set({ appearance })
        applyAppearance(appearance)
      },
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    { name: 'wm-ui', partialize: (s) => ({ appearance: s.appearance }) },
  ),
)

export function applyAppearance(a: Appearance) {
  const dark = a === 'dark' || (a === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', !!dark)
}
