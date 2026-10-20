import { create } from 'zustand'
import { duplicateBlock, insertBlock, moveBlock, removeBlock, reorder, updateBlock } from '@/features/builder/block-ops'
import type { Block, BlockStyle, Device, ThemeTokens } from '@/types'

const HISTORY_LIMIT = 100
const COALESCE_MS = 800

interface EditorState {
  pageId: number | null
  blocks: Block[]
  past: Block[][]
  future: Block[][]
  selectedId: string | null
  dirty: boolean
  device: Device
  theme: ThemeTokens | null
  preset: string
  themeDirty: boolean
  lastEdit: { key: string; at: number } | null

  loadPage: (pageId: number, blocks: Block[]) => void
  loadTheme: (preset: string, tokens: ThemeTokens) => void
  commit: (next: Block[], coalesceKey?: string) => void
  undo: () => void
  redo: () => void
  select: (id: string | null) => void
  setDevice: (d: Device) => void
  add: (block: Block) => void
  addMany: (blocks: Block[]) => void
  remove: (id: string) => void
  duplicate: (id: string) => void
  move: (id: string, delta: number) => void
  reorderTo: (from: number, to: number) => void
  patch: (id: string, patch: { props?: Record<string, unknown>; style?: Partial<BlockStyle>; hidden?: boolean; hiddenOn?: Device[] }, coalesceKey?: string) => void
  setTheme: (tokens: Partial<ThemeTokens>, preset?: string) => void
  markSaved: (what: 'page' | 'theme') => void
}

export const useEditor = create<EditorState>((set, get) => ({
  pageId: null,
  blocks: [],
  past: [],
  future: [],
  selectedId: null,
  dirty: false,
  device: 'desktop',
  theme: null,
  preset: 'custom',
  themeDirty: false,
  lastEdit: null,

  loadPage: (pageId, blocks) => set({ pageId, blocks, past: [], future: [], selectedId: null, dirty: false, lastEdit: null }),
  loadTheme: (preset, tokens) => set({ preset, theme: tokens, themeDirty: false }),

  commit: (next, coalesceKey) => {
    const { blocks, past, lastEdit } = get()
    if (next === blocks) return
    const now = Date.now()
    const coalesce = coalesceKey && lastEdit && lastEdit.key === coalesceKey && now - lastEdit.at < COALESCE_MS
    set({
      blocks: next,
      past: coalesce ? past : [...past, blocks].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
      lastEdit: coalesceKey ? { key: coalesceKey, at: now } : null,
    })
  },
  undo: () => {
    const { past, blocks, future, selectedId } = get()
    if (!past.length) return
    const prev = past[past.length - 1]
    set({
      blocks: prev,
      past: past.slice(0, -1),
      future: [blocks, ...future],
      dirty: true,
      lastEdit: null,
      selectedId: prev.some((b) => b.id === selectedId) ? selectedId : null,
    })
  },
  redo: () => {
    const { past, blocks, future, selectedId } = get()
    if (!future.length) return
    const next = future[0]
    set({
      blocks: next,
      past: [...past, blocks],
      future: future.slice(1),
      dirty: true,
      lastEdit: null,
      selectedId: next.some((b) => b.id === selectedId) ? selectedId : null,
    })
  },
  select: (selectedId) => set({ selectedId }),
  setDevice: (device) => set({ device }),
  add: (block) => {
    get().commit(insertBlock(get().blocks, block, get().selectedId))
    set({ selectedId: block.id })
  },
  addMany: (list) => {
    let next = get().blocks
    let after = get().selectedId
    for (const b of list) {
      next = insertBlock(next, b, after)
      after = b.id
    }
    get().commit(next)
    set({ selectedId: list[0]?.id ?? null })
  },
  remove: (id) => {
    get().commit(removeBlock(get().blocks, id))
    if (get().selectedId === id) set({ selectedId: null })
  },
  duplicate: (id) => {
    const { blocks, newId } = duplicateBlock(get().blocks, id)
    get().commit(blocks)
    set({ selectedId: newId })
  },
  move: (id, delta) => get().commit(moveBlock(get().blocks, id, delta)),
  reorderTo: (from, to) => get().commit(reorder(get().blocks, from, to)),
  patch: (id, patch, coalesceKey) => get().commit(updateBlock(get().blocks, id, patch), coalesceKey),
  setTheme: (tokens, preset) => {
    const theme = get().theme
    if (!theme) return
    set({ theme: { ...theme, ...tokens }, preset: preset ?? 'custom', themeDirty: true })
  },
  markSaved: (what) => set(what === 'page' ? { dirty: false } : { themeDirty: false }),
}))
