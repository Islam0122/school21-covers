import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Boxes, ClipboardList, History, LayoutDashboard, Menu, Sparkles, Truck, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Movements, Staff, Suppliers } from '@/features/smartstock/admin'
import { STORE_ROLE_LABELS, StoreContext } from '@/features/smartstock/context'
import { Dashboard } from '@/features/smartstock/dashboard'
import { Insights } from '@/features/smartstock/insights'
import { Inventory } from '@/features/smartstock/inventory'
import { Orders } from '@/features/smartstock/orders'
import { cn } from '@/lib/utils'
import { smartstockApi } from '@/services/api'
import { ApiError } from '@/services/http'

const NAV = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, title: 'Dashboard' },
  { to: 'inventory', label: 'Inventory', icon: Boxes, title: 'Inventory' },
  { to: 'insights', label: 'AI Insights', icon: Sparkles, title: 'AI Insights' },
  { to: 'orders', label: 'Purchase Orders', icon: ClipboardList, title: 'Purchase Orders' },
  { to: 'suppliers', label: 'Suppliers', icon: Truck, title: 'Suppliers' },
  { to: 'movements', label: 'Stock Movements', icon: History, title: 'Stock Movements' },
  { to: 'staff', label: 'Staff & Roles', icon: Users, title: 'Staff & Roles' },
]

export default function SmartStockApp() {
  const { storeId = '' } = useParams()
  const id = Number(storeId)
  const location = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [location.pathname])
  const { data: store, isLoading, error, refetch } = useQuery({ queryKey: ['smartstock', id, 'store'], queryFn: () => smartstockApi.store(id) })
  if (isLoading) return <LoadingState className="h-screen" label="Opening SmartStock AI…" />
  if (error instanceof ApiError && error.status === 404)
    return <div className="p-8"><EmptyState title="Store not available" description="This store doesn’t exist or you don’t have a SmartStock role for it." action={<Button asChild><Link to="/app">Back to WebMindClub</Link></Button>} /></div>
  if (error || !store) return <ErrorState className="m-8" error={error} onRetry={() => refetch()} />
  const base = `/smartstock/${store.id}`
  const section = location.pathname.replace(base, '').replace(/^\//, '').split('/')[0]
  const current = NAV.find((n) => n.to === section) ?? NAV[0]

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 text-white"><Boxes className="size-4" /></span>
        <div className="leading-tight">
          <p className="font-display font-bold">SmartStock <span className="text-gradient">AI</span></p>
          <p className="text-[10px] text-muted">by WebMindClub</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="SmartStock">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to ? `${base}/${to}` : base} end={!to} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-emerald-500/12 text-fg shadow-[inset_2px_0_0_#10b981]' : 'text-muted hover:bg-hover hover:text-fg')}>
            <Icon className="size-4" /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-xl border border-line p-3 text-xs">
        <p className="font-medium">{store.name}</p>
        <p className="mt-0.5 text-muted">Your role: {store.role ? STORE_ROLE_LABELS[store.role] : '—'}</p>
        <Link to={`/app/projects/${store.project}`} className="mt-2 flex items-center gap-1 text-brand-blue hover:underline"><ArrowLeft className="size-3" /> Back to WebMindClub project</Link>
      </div>
    </div>
  )

  return (
    <StoreContext.Provider value={store}>
      <div className="min-h-screen lg:pl-64">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface">
              <Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Close menu" onClick={() => setOpen(false)}><X /></Button>
              {sidebar}
            </aside>
          </div>
        )}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></Button>
          <h1 className="font-display text-lg font-semibold">{current.title}</h1>
          <span className="flex-1" />
          <Badge tone="cyan" className="hidden sm:inline-flex">Demo data · {store.currency}</Badge>
          {store.role === 'analyst' && <Badge tone="amber">Read-only</Badge>}
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="insights" element={<Insights />} />
            <Route path="orders" element={<Orders />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="movements" element={<Movements />} />
            <Route path="staff" element={<Staff />} />
            <Route path="*" element={<EmptyState title="Page not found" action={<Button asChild><Link to={base}>Dashboard</Link></Button>} />} />
          </Routes>
        </main>
      </div>
    </StoreContext.Provider>
  )
}
