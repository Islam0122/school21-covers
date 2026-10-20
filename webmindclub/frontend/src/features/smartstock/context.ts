import { createContext, useContext } from 'react'
import type { Store } from '@/types'

export const StoreContext = createContext<Store | null>(null)

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside SmartStock')
  return store
}

export function canWrite(store: Store) {
  return store.role === 'store_manager' || store.role === 'inventory_clerk'
}

export const ssk = {
  dashboard: (id: number) => ['smartstock', id, 'dashboard'] as const,
  products: (id: number, q: object) => ['smartstock', id, 'products', q] as const,
  categories: (id: number) => ['smartstock', id, 'categories'] as const,
  suppliers: (id: number) => ['smartstock', id, 'suppliers'] as const,
  orders: (id: number, q: object) => ['smartstock', id, 'orders', q] as const,
  movements: (id: number, q: object) => ['smartstock', id, 'movements', q] as const,
  insights: (id: number) => ['smartstock', id, 'insights'] as const,
  staff: (id: number) => ['smartstock', id, 'staff'] as const,
}

export const STORE_ROLE_LABELS = { store_manager: 'Store Manager', inventory_clerk: 'Inventory Clerk', analyst: 'Analyst (read-only)' } as const
