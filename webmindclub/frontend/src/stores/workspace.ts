import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WorkspaceState {
  currentId: number | null
  setCurrent: (id: number) => void
}

/** Remembers the active workspace per browser; the server still checks membership on every request. */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist((set) => ({ currentId: null, setCurrent: (id) => set({ currentId: id }) }), { name: 'wm-workspace' }),
)
